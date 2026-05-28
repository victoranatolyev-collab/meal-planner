import { ApiError, apiGet, apiPut } from './client';

/** Decimal-поля backend сериализуются в строки (Prisma Decimal → JSON string). */
export interface NutritionTargetDto {
  id: string;
  userId: string;
  kcalPerDay: string;
  proteinGPerDay: string;
  fatGPerDay: string;
  carbsGPerDay: string;
  proteinGPerKgMin: string | null;
  budgetTargetRubPerWeek: string | null;
  budgetSoftCapRubPerWeek: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionTargetUpsertBody {
  userId: string;
  kcalPerDay: number;
  proteinGPerDay: number;
  fatGPerDay: number;
  carbsGPerDay: number;
  proteinGPerKgMin?: number;
  budgetTargetRubPerWeek?: number;
  budgetSoftCapRubPerWeek?: number;
}

/** GET цели КБЖУ. 404 (ещё не заданы) → null. */
export async function fetchNutritionTarget(userId: string): Promise<NutritionTargetDto | null> {
  try {
    return await apiGet<NutritionTargetDto>(`/nutrition-targets?userId=${encodeURIComponent(userId)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export const putNutritionTarget = (body: NutritionTargetUpsertBody) =>
  apiPut<NutritionTargetDto>('/nutrition-targets', body);
