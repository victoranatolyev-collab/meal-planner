import type { ActivityLevel, Goal, Sex } from '@prisma/client';

/**
 * Входы расчёта норм (scr-calc-norms). Берутся из последнего снимка anthropometry
 * + опц. proteinGPerKg из nutrition_targets.
 */
export interface NormsInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Целевой белок, г/кг массы тела. Default 1.8 (силовой атлет). */
  proteinGPerKg?: number;
  /** Доля жира от калорийности, 0..1. Default 0.30. */
  fatPercent?: number;
}

/** Результат расчёта целевых КБЖУ. */
export interface NormsResult {
  bmr: number; // Mifflin-St Jeor, ккал
  tdee: number; // bmr × activity
  kcalPerDay: number; // tdee × goal adjustment
  proteinGPerDay: number;
  fatGPerDay: number;
  carbsGPerDay: number;
  breakdown: {
    activityMultiplier: number;
    goalMultiplier: number;
    proteinGPerKg: number;
    fatPercent: number;
  };
}
