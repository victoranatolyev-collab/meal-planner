import { prisma } from '../db.js';
import { calcNorms } from './calc.js';
import type { NormsResult } from './types.js';

export interface CalcNormsForUserResult extends NormsResult {
  source: { anthropometryId: string; measuredAt: Date };
}

/**
 * scr-calc-norms (DB-wrapper): целевые КБЖУ для пользователя из ПОСЛЕДНЕГО снимка anthropometry.
 * proteinGPerKg — из nutrition_targets.proteinGPerKgMin (если задан), иначе default в calcNorms.
 *
 * Возвращает рекомендацию; НЕ перезаписывает NutritionTarget (его правит пользователь
 * через /rules). Бросает Error если нет anthropometry или не заполнены activityLevel/goal.
 */
export async function calcNormsForUser(userId: string): Promise<CalcNormsForUserResult> {
  const anthro = await prisma.anthropometry.findFirst({
    where: { userId },
    orderBy: { measuredAt: 'desc' },
  });
  if (!anthro) {
    throw new Error(`Нет anthropometry для пользователя ${userId} — нечего считать`);
  }
  if (anthro.activityLevel === null || anthro.goal === null) {
    throw new Error(
      `Anthropometry ${anthro.id}: не заданы activityLevel/goal — обязательны для расчёта норм`,
    );
  }

  const target = await prisma.nutritionTarget.findUnique({ where: { userId } });
  const proteinGPerKg =
    target?.proteinGPerKgMin != null ? Number(target.proteinGPerKgMin) : undefined;

  const result = calcNorms({
    sex: anthro.sex,
    ageYears: anthro.ageYears,
    heightCm: Number(anthro.heightCm),
    weightKg: Number(anthro.weightKg),
    activityLevel: anthro.activityLevel,
    goal: anthro.goal,
    proteinGPerKg,
  });

  return { ...result, source: { anthropometryId: anthro.id, measuredAt: anthro.measuredAt } };
}
