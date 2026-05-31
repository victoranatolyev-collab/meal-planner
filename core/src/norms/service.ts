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
  if (anthro.goal === null) {
    throw new Error(`Anthropometry ${anthro.id}: не задана goal — обязательна для расчёта норм`);
  }
  const hasGranular =
    anthro.stepsPerDay !== null ||
    anthro.strengthMinutesPerWeek !== null ||
    anthro.cardioMinutesPerWeek !== null;
  if (!hasGranular && anthro.activityLevel === null) {
    throw new Error(
      `Anthropometry ${anthro.id}: задайте шаги/силовые/кардио (модель активности) или activityLevel`,
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
    goal: anthro.goal,
    ...(anthro.activityLevel !== null ? { activityLevel: anthro.activityLevel } : {}),
    ...(anthro.stepsPerDay !== null ? { stepsPerDay: anthro.stepsPerDay } : {}),
    ...(anthro.strengthMinutesPerWeek !== null
      ? { strengthMinutesPerWeek: anthro.strengthMinutesPerWeek }
      : {}),
    ...(anthro.cardioMinutesPerWeek !== null
      ? { cardioMinutesPerWeek: anthro.cardioMinutesPerWeek }
      : {}),
    proteinGPerKg,
  });

  return { ...result, source: { anthropometryId: anthro.id, measuredAt: anthro.measuredAt } };
}
