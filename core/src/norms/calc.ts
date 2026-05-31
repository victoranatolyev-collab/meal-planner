import type { ActivityLevel, Goal } from '@prisma/client';
import type { NormsInput, NormsResult } from './types.js';

/**
 * Pure: расчёт целевых КБЖУ (scr-calc-norms). Без side-effects/БД.
 *
 * BMR — Mifflin-St Jeor. Расход активности — модель doctorushakov.com/calculator:
 *   BMR + шаги×0.03 + силовые_мин/нед×5/7 + кардио_мин/нед×7/7 + TEF (термоэффект пищи).
 * TEF считается ПО НУТРИЕНТАМ (белок дороже всего): циклическая зависимость TEF↔макросы
 * решается итеративно. Если гранулярных входов (шаги/силовые/кардио) нет — fallback на
 * грубый activityLevel-множитель (множитель уже включает NEAT+TEF, поэтому TEF отдельно НЕ добавляем).
 * kcal = TDEE(maintenance) × goal-поправка.
 * Макросы: белок = г/кг×вес; жир = г/кг×вес; углеводы — остаток калорий.
 *
 * Это ОЦЕНКА. authoritative-цели правит пользователь через /rules (NutritionTarget).
 * Reference: data/nutrition_norms.json (источник коэффициентов — doctorushakov).
 */

/** Множители активности к BMR — fallback, когда нет гранулярных входов (шаги/тренировки). */
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
const DEFAULT_FAT_G_PER_KG = 0.8;

// Коэффициенты модели doctorushakov (расход на активность).
const KCAL_PER_STEP = 0.03; // 10 000 шагов = 300 ккал
const KCAL_PER_STRENGTH_MIN = 5; // силовая: 5 ккал/мин
const KCAL_PER_CARDIO_MIN = 7; // кардио: ~7 ккал/мин (150 мин/нед = +150 ккал/день)

// TEF — термический эффект пищи (доля калорий нутриента, уходящая на переваривание).
const TEF_PROTEIN = 0.25; // белок: 20–30%
const TEF_CARBS = 0.1; // углеводы: ~10%
const TEF_FAT = 0.02; // жиры: 0–3%

const round = (v: number): number => Math.round(v);

/** Есть ли хотя бы один гранулярный вход активности (шаги/силовые/кардио). */
function hasGranularActivity(input: NormsInput): boolean {
  return (
    input.stepsPerDay != null ||
    input.strengthMinutesPerWeek != null ||
    input.cardioMinutesPerWeek != null
  );
}

/**
 * Решает maintenance-TDEE с TEF по нутриентам. TEF зависит от макросов, макросы — от интейка,
 * поэтому фикс-пойнт итерацией (быстро сходится, ~5 шагов). proteinKcal фиксирован (г/кг×вес×4).
 */
function solveTdeeWithTef(baseExpenditure: number, proteinKcal: number, fatKcal: number): number {
  let tdee = baseExpenditure;
  for (let i = 0; i < 16; i += 1) {
    // Белок и жир фиксированы (г/кг×вес), от tdee зависят только углеводы (остаток).
    const carbsKcal = Math.max(0, tdee - proteinKcal - fatKcal);
    const tef = TEF_PROTEIN * proteinKcal + TEF_CARBS * carbsKcal + TEF_FAT * fatKcal;
    const next = baseExpenditure + tef;
    if (Math.abs(next - tdee) < 0.5) return next;
    tdee = next;
  }
  return tdee;
}

export function calcNorms(input: NormsInput): NormsResult {
  const proteinGPerKg = input.proteinGPerKg ?? DEFAULT_PROTEIN_G_PER_KG;
  const fatGPerKg = input.fatGPerKg ?? DEFAULT_FAT_G_PER_KG;
  const goalMultiplier = GOAL_MULTIPLIER[input.goal];
  const proteinGPerDay = proteinGPerKg * input.weightKg;
  const fatGPerDay = fatGPerKg * input.weightKg;
  const proteinKcal = proteinGPerDay * 4;
  const fatKcal = fatGPerDay * 9;

  // BMR — Mifflin-St Jeor (sex-константа: +5 male, -161 female).
  const sexConst = input.sex === 'MALE' ? 5 : -161;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + sexConst;

  let tdee: number;
  const breakdown: NormsResult['breakdown'] = { goalMultiplier, proteinGPerKg, fatGPerKg };

  if (hasGranularActivity(input)) {
    // Модель doctorushakov: BMR + активность + TEF (по нутриентам).
    const stepsKcal = (input.stepsPerDay ?? 0) * KCAL_PER_STEP;
    const strengthKcal = ((input.strengthMinutesPerWeek ?? 0) * KCAL_PER_STRENGTH_MIN) / 7;
    const cardioKcal = ((input.cardioMinutesPerWeek ?? 0) * KCAL_PER_CARDIO_MIN) / 7;
    const activityKcal = stepsKcal + strengthKcal + cardioKcal;
    const baseExpenditure = bmr + activityKcal;
    tdee = solveTdeeWithTef(baseExpenditure, proteinKcal, fatKcal);
    breakdown.stepsKcal = round(stepsKcal);
    breakdown.strengthKcal = round(strengthKcal);
    breakdown.cardioKcal = round(cardioKcal);
    breakdown.activityKcal = round(activityKcal);
    breakdown.tefKcal = round(tdee - baseExpenditure);
  } else if (input.activityLevel) {
    // Fallback: грубый множитель (уже включает NEAT+TEF — отдельный TEF НЕ добавляем).
    const activityMultiplier = ACTIVITY_MULTIPLIER[input.activityLevel];
    tdee = bmr * activityMultiplier;
    breakdown.activityMultiplier = activityMultiplier;
  } else {
    throw new Error('calcNorms: нужны либо шаги/силовые/кардио, либо activityLevel');
  }

  const kcalPerDay = tdee * goalMultiplier;

  // Макросы: белок и жир по г/кг (фикс), углеводы — остаток калорий.
  const carbsKcal = Math.max(0, kcalPerDay - proteinKcal - fatKcal);
  const carbsGPerDay = carbsKcal / 4;

  return {
    bmr: round(bmr),
    tdee: round(tdee),
    kcalPerDay: round(kcalPerDay),
    proteinGPerDay: round(proteinGPerDay),
    fatGPerDay: round(fatGPerDay),
    carbsGPerDay: round(carbsGPerDay),
    breakdown,
  };
}
