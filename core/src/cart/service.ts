import pino from 'pino';
import { prisma } from '../db.js';
import { assembleCartLines } from './assemble.js';
import type { PlanItemRef, RecipeIngredientRef } from './types.js';

const logger = pino({ name: 'cart:assemble' });

export interface AssembleCartResult {
  cartId: string;
  lines: number;
  byShop: Record<string, number>;
}

/**
 * scr-assemble-cart (DB-wrapper): план недели − остатки → ACTIVE Cart с CartItem (по shop).
 * Регенерация: существующая ACTIVE-корзина пользователя заменяется.
 * Бросает Error если плана нет или он пуст.
 */
export async function assembleCart(userId: string, weekIso: string): Promise<AssembleCartResult> {
  const plan = await prisma.weekPlan.findUnique({
    where: { uniq_user_week: { userId, weekIso } },
    include: { days: { include: { meals: { include: { items: true } } } } },
  });
  if (!plan) throw new Error(`Нет плана ${weekIso} для ${userId} — нечего собирать`);

  const planItems: PlanItemRef[] = plan.days
    .flatMap((d) => d.meals)
    .flatMap((m) => m.items)
    .map((it) => ({ recipeId: it.recipeId, portionFactor: Number(it.portionFactor) }));
  if (planItems.length === 0) throw new Error(`План ${weekIso} пуст — нечего собирать`);

  const recipeIds = [...new Set(planItems.map((p) => p.recipeId))];
  const ris = await prisma.recipeIngredient.findMany({
    where: { recipeId: { in: recipeIds } },
    include: { ingredient: { select: { source: true } } },
  });
  const recipeIngredients = new Map<string, RecipeIngredientRef[]>();
  for (const ri of ris) {
    const arr = recipeIngredients.get(ri.recipeId) ?? [];
    arr.push({ ingredientId: ri.ingredientId, qtyG: ri.qtyG, shop: ri.ingredient.source });
    recipeIngredients.set(ri.recipeId, arr);
  }

  const stock = await prisma.stockItem.findMany({ where: { userId } });
  const stockGrams = new Map(stock.map((s) => [s.ingredientId, s.qtyG]));

  const lines = assembleCartLines({ planItems, recipeIngredients, stockGrams });

  const cart = await prisma.$transaction(async (tx) => {
    await tx.cart.deleteMany({ where: { userId, status: 'ACTIVE' } });
    return tx.cart.create({
      data: {
        userId,
        status: 'ACTIVE',
        items: {
          create: lines.map((l) => ({ ingredientId: l.ingredientId, qtyG: l.qtyG, shop: l.shop })),
        },
      },
    });
  });

  const byShop: Record<string, number> = {};
  for (const l of lines) byShop[l.shop] = (byShop[l.shop] ?? 0) + 1;

  logger.info({ userId, weekIso, cartId: cart.id, lines: lines.length, byShop }, 'cart assembled');
  return { cartId: cart.id, lines: lines.length, byShop };
}

/** Активная корзина пользователя с позициями (+ инфо ингредиента). null если нет. */
export async function getActiveCart(userId: string) {
  return prisma.cart.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        orderBy: [{ shop: 'asc' }],
        include: {
          ingredient: { select: { id: true, name: true, source: true, pricePer100g: true } },
        },
      },
    },
  });
}
