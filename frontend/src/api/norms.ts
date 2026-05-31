import { apiGet } from './client';

/**
 * Рекомендованные нормы из последнего снимка антропометрии (scr-calc-norms).
 * Числовые поля (calcNorms возвращает round(), не Decimal).
 */
export interface NormsDto {
  bmr: number;
  tdee: number;
  kcalPerDay: number;
  proteinGPerDay: number;
  fatGPerDay: number;
  carbsGPerDay: number;
  breakdown: {
    goalMultiplier: number;
    proteinGPerKg: number;
    fatGPerKg: number;
    activityMultiplier?: number;
    stepsKcal?: number;
    strengthKcal?: number;
    cardioKcal?: number;
    activityKcal?: number;
    tefKcal?: number;
  };
  source: { anthropometryId: string; measuredAt: string };
}

/** GET рекомендованные нормы. 422 (нет антропометрии) → ApiError. */
export const fetchNorms = (userId: string) =>
  apiGet<NormsDto>(`/norms?userId=${encodeURIComponent(userId)}`);
