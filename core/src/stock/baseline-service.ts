import { z } from 'zod';
import { prisma } from '../db.js';

/**
 * CRUD базового запаса (StockItem) — «инвентаризация»: то, что есть дома сейчас.
 * Это слагаемое `baseline` в проекции остатков (baseline + закупки − съедено).
 * scr-calc-stock проекция — отдельно (service.ts); здесь — правка самого запаса.
 */

export const stockItemUpsertSchema = z.object({
  userId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  qtyG: z.number().int().min(0).max(1_000_000),
});
export type StockItemUpsert = z.infer<typeof stockItemUpsertSchema>;

export const stockItemDeleteSchema = z.object({
  userId: z.string().uuid(),
  ingredientId: z.string().uuid(),
});

/** Базовый запас пользователя (StockItem) + имя ингредиента. */
export async function listStockBaseline(userId: string) {
  return prisma.stockItem.findMany({
    where: { userId },
    orderBy: { ingredient: { name: 'asc' } },
    select: {
      id: true,
      ingredientId: true,
      qtyG: true,
      ingredient: { select: { name: true } },
    },
  });
}

/** Upsert базового запаса по (userId, ingredientId). qtyG=0 → удаляем строку. */
export async function upsertStockItem(input: StockItemUpsert) {
  if (input.qtyG === 0) {
    await prisma.stockItem.deleteMany({
      where: { userId: input.userId, ingredientId: input.ingredientId },
    });
    return { deleted: true };
  }
  const row = await prisma.stockItem.upsert({
    where: { uniq_user_ingredient: { userId: input.userId, ingredientId: input.ingredientId } },
    create: { userId: input.userId, ingredientId: input.ingredientId, qtyG: input.qtyG },
    update: { qtyG: input.qtyG },
    select: { id: true },
  });
  return { id: row.id };
}

export async function deleteStockItem(userId: string, ingredientId: string) {
  await prisma.stockItem.deleteMany({ where: { userId, ingredientId } });
  return { deleted: true };
}
