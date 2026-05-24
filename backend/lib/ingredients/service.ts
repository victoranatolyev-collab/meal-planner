import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import type { ListIngredientsQuery } from './schemas';

/**
 * Бизнес-логика выборки ингредиентов с пагинацией и фильтром.
 * Тонкий wrapper над prisma — отделён от route handler для тестируемости
 * и переиспользования в Telegram-агенте (tool-use).
 */
export async function listIngredients(query: ListIngredientsQuery) {
  const where: Prisma.IngredientWhereInput = {};
  if (query.source) where.source = query.source;
  if (query.q) where.name = { contains: query.q, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: query.offset,
      take: query.limit,
    }),
    prisma.ingredient.count({ where }),
  ]);

  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}
