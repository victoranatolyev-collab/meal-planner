import pino from 'pino';
import { prisma } from '../db.js';
import { scaleMacros } from './macros.js';
import type { DiaryEntryCreate } from './schemas.js';

const logger = pino({ name: 'diary:write' });

/**
 * scr-write-diary: фиксирует фактически съеденное в food_diary.
 * Если указан recipeId и макросы не переданы — derive из recipe totals × portionFactor
 * (снимок в запись, переживает удаление рецепта). Иначе используются переданные макросы.
 */
export async function writeDiaryEntry(input: DiaryEntryCreate) {
  const factor = input.portionFactor;
  let kcal = input.kcal ?? null;
  let proteinG = input.proteinG ?? null;
  let fatG = input.fatG ?? null;
  let carbsG = input.carbsG ?? null;

  if (input.recipeId) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: input.recipeId },
      select: { totalKcal: true, totalProteinG: true, totalFatG: true, totalCarbsG: true },
    });
    if (!recipe) throw new Error(`Рецепт ${input.recipeId} не найден`);
    // Derive только если макросы не заданы явно.
    if (kcal === null && proteinG === null && fatG === null && carbsG === null) {
      const scaled = scaleMacros(
        {
          kcal: recipe.totalKcal !== null ? Number(recipe.totalKcal) : null,
          proteinG: recipe.totalProteinG !== null ? Number(recipe.totalProteinG) : null,
          fatG: recipe.totalFatG !== null ? Number(recipe.totalFatG) : null,
          carbsG: recipe.totalCarbsG !== null ? Number(recipe.totalCarbsG) : null,
        },
        factor,
      );
      kcal = scaled.kcal;
      proteinG = scaled.proteinG;
      fatG = scaled.fatG;
      carbsG = scaled.carbsG;
    }
  }

  const entry = await prisma.foodDiaryEntry.create({
    data: {
      userId: input.userId,
      eatenAt: input.eatenAt ?? new Date(),
      recipeId: input.recipeId ?? null,
      customName: input.customName ?? null,
      portionFactor: factor,
      kcal,
      proteinG,
      fatG,
      carbsG,
      mealName: input.mealName ?? null,
      note: input.note ?? null,
    },
  });

  logger.info({ userId: input.userId, entryId: entry.id, recipeId: input.recipeId }, 'diary entry written');
  return entry;
}

/** Последние записи дневника пользователя. */
export async function listDiary(userId: string, limit = 50) {
  return prisma.foodDiaryEntry.findMany({
    where: { userId },
    orderBy: { eatenAt: 'desc' },
    take: limit,
    include: { recipe: { select: { id: true, name: true } } },
  });
}
