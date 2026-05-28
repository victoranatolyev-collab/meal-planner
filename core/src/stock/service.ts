import pino from 'pino';
import { prisma } from '../db.js';
import { projectStock } from './project.js';
import type { StockProjectionLine } from './types.js';

const logger = pino({ name: 'stock:calc' });

export interface CalcStockResult {
  lines: StockProjectionLine[];
  asOf: string;
}

/**
 * scr-calc-stock (DB-wrapper): проекция текущих остатков пользователя.
 * baseline = StockItem; bought = order_history (OrderItem); consumed = food_diary
 * (записи с recipeId → recipe_ingredients × portionFactor). Ad-hoc записи (без рецепта)
 * не влияют на остатки каталога. Возвращает отчёт (не мутирует StockItem).
 */
export async function calcStock(userId: string): Promise<CalcStockResult> {
  // baseline
  const stock = await prisma.stockItem.findMany({ where: { userId } });
  const baseline = new Map(stock.map((s) => [s.ingredientId, s.qtyG]));

  // bought (все заказы пользователя)
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { userId } },
    select: { ingredientId: true, qtyG: true },
  });
  const bought = new Map<string, number>();
  for (const oi of orderItems) {
    bought.set(oi.ingredientId, (bought.get(oi.ingredientId) ?? 0) + oi.qtyG);
  }

  // consumed (дневник с рецептами → ингредиенты × portionFactor)
  const diary = await prisma.foodDiaryEntry.findMany({
    where: { userId, recipeId: { not: null } },
    select: { recipeId: true, portionFactor: true },
  });
  const recipeIds = [...new Set(diary.map((d) => d.recipeId).filter((x): x is string => x !== null))];
  const ris = recipeIds.length
    ? await prisma.recipeIngredient.findMany({
        where: { recipeId: { in: recipeIds } },
        select: { recipeId: true, ingredientId: true, qtyG: true },
      })
    : [];
  const byRecipe = new Map<string, Array<{ ingredientId: string; qtyG: number }>>();
  for (const ri of ris) {
    const arr = byRecipe.get(ri.recipeId) ?? [];
    arr.push({ ingredientId: ri.ingredientId, qtyG: ri.qtyG });
    byRecipe.set(ri.recipeId, arr);
  }
  const consumed = new Map<string, number>();
  for (const entry of diary) {
    if (!entry.recipeId) continue;
    const factor = Number(entry.portionFactor);
    for (const ing of byRecipe.get(entry.recipeId) ?? []) {
      consumed.set(ing.ingredientId, (consumed.get(ing.ingredientId) ?? 0) + ing.qtyG * factor);
    }
  }

  const lines = projectStock({ baseline, bought, consumed });
  logger.info({ userId, ingredients: lines.length }, 'stock projected');
  return { lines, asOf: new Date().toISOString() };
}
