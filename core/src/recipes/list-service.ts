import { prisma } from '../db.js';

/**
 * Список рецептов пользователя для просмотра пула (scr-list-recipes, read-only).
 * По умолчанию — ПУЛ планировщика: approved + normalized (именно из них собирается план недели).
 * `includeAll=true` вернёт все рецепты пользователя с флагами (для отладки/будущего UI).
 *
 * Возвращает рецепт + теги + состав (имя ингредиента + граммовка). Decimal-поля сериализуются
 * в строки на границе HTTP — фронт парсит через Number().
 */
export async function listRecipes(userId: string, includeAll = false) {
  return prisma.recipe.findMany({
    where: includeAll ? { userId } : { userId, isApproved: true, isNormalized: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      instructions: true,
      source: true,
      isApproved: true,
      isNormalized: true,
      totalKcal: true,
      totalProteinG: true,
      totalFatG: true,
      totalCarbsG: true,
      tags: { select: { tagName: true } },
      ingredients: {
        orderBy: { qtyG: 'desc' },
        select: {
          qtyG: true,
          freshAddon: true,
          ingredient: {
            select: {
              id: true,
              name: true,
              kcal100g: true,
              protein100g: true,
              fat100g: true,
              carbs100g: true,
            },
          },
        },
      },
    },
  });
}
