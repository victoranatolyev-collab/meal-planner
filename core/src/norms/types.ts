import type { ActivityLevel, Goal, Sex } from '@prisma/client';

/**
 * Входы расчёта норм (scr-calc-norms). Берутся из последнего снимка anthropometry
 * + опц. proteinGPerKg из nutrition_targets.
 *
 * Активность: предпочтительно гранулярно (шаги/силовые/кардио — модель doctorushakov);
 * если их нет — fallback на activityLevel-множитель.
 */
export interface NormsInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  /** Грубый уровень активности — fallback, если нет шагов/тренировок. */
  activityLevel?: ActivityLevel;
  /** Шаги в день (NEAT). */
  stepsPerDay?: number;
  /** Минуты силовых тренировок в неделю. */
  strengthMinutesPerWeek?: number;
  /** Минуты кардио в неделю. */
  cardioMinutesPerWeek?: number;
  /** Целевой белок, г/кг массы тела. Default 1.8 (силовой атлет). */
  proteinGPerKg?: number;
  /** Целевой жир, г/кг массы тела. Default 0.8. */
  fatGPerKg?: number;
}

/** Результат расчёта целевых КБЖУ. */
export interface NormsResult {
  bmr: number; // Mifflin-St Jeor, ккал
  tdee: number; // maintenance: BMR + активность (+TEF в гранулярном режиме)
  kcalPerDay: number; // tdee × goal adjustment
  proteinGPerDay: number;
  fatGPerDay: number;
  carbsGPerDay: number;
  breakdown: {
    goalMultiplier: number;
    proteinGPerKg: number;
    fatGPerKg: number;
    /** Fallback-режим: множитель активности. */
    activityMultiplier?: number;
    /** Гранулярный режим: компоненты расхода (ккал/день). */
    stepsKcal?: number;
    strengthKcal?: number;
    cardioKcal?: number;
    activityKcal?: number;
    tefKcal?: number;
  };
}
