import type { ActivityLevel, Goal } from '@prisma/client';
import type { NormsInput, NormsResult } from './types.js';

/**
 * Pure: расчёт целевых КБЖУ (scr-calc-norms). Без side-effects/БД.
 *
 * BMR — Mifflin-St Jeor. TDEE = BMR × activity. kcal = TDEE × goal-поправка.
 * Макросы: белок = г/кг × вес; жир = fatPercent от kcal; углеводы = остаток.
 *
 * Это ОЦЕНКА-предложение. authoritative-цели правит пользователь через /rules
 * (NutritionTarget). Reference: data/nutrition_norms.json (main).
 */

/** Множители активности к BMR (Harris-Benedict / стандартные). */
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

/** Калорийная поправка под цель. */
const GOAL_MULTIPLIER: Record<Goal, number> = {
  CUT: 0.85,
  MAINTAIN: 1.0,
  GAIN: 1.1,
};

const DEFAULT_PROTEIN_G_PER_KG = 1.8;
const DEFAULT_FAT_PERCENT = 0.3;

export function calcNorms(input: NormsInput): NormsResult {
  const proteinGPerKg = input.proteinGPerKg ?? DEFAULT_PROTEIN_G_PER_KG;
  const fatPercent = input.fatPercent ?? DEFAULT_FAT_PERCENT;
  const activityMultiplier = ACTIVITY_MULTIPLIER[input.activityLevel];
  const goalMultiplier = GOAL_MULTIPLIER[input.goal];

  // BMR — Mifflin-St Jeor (sex-константа: +5 male, -161 female).
  const sexConst = input.sex === 'MALE' ? 5 : -161;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + sexConst;
  const tdee = bmr * activityMultiplier;
  const kcalPerDay = tdee * goalMultiplier;

  // Макросы: белок по г/кг, жир по %, углеводы — остаток калорий.
  const proteinGPerDay = proteinGPerKg * input.weightKg;
  const fatGPerDay = (kcalPerDay * fatPercent) / 9;
  const carbsKcal = Math.max(0, kcalPerDay - proteinGPerDay * 4 - fatGPerDay * 9);
  const carbsGPerDay = carbsKcal / 4;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcalPerDay: Math.round(kcalPerDay),
    proteinGPerDay: Math.round(proteinGPerDay),
    fatGPerDay: Math.round(fatGPerDay),
    carbsGPerDay: Math.round(carbsGPerDay),
    breakdown: { activityMultiplier, goalMultiplier, proteinGPerKg, fatPercent },
  };
}
