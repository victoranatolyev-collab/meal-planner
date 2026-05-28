import { ApiError, apiGet } from './client';

export interface PlanListItem {
  id: string;
  weekIso: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface PlanItemDto {
  recipeId: string;
  portionFactor: string; // Decimal → string
  fromStock: boolean;
  tail: boolean;
  sortOrder: number;
  recipe: { id: string; name: string; totalKcal: string | null } | null;
}

export interface PlanMealDto {
  id: string;
  name: string;
  time: string | null;
  mealTags: string[];
  sortOrder: number;
  items: PlanItemDto[];
}

export interface PlanDayDto {
  id: string;
  date: string;
  dayType: string | null;
  meals: PlanMealDto[];
}

export interface WeekPlanDto {
  id: string;
  weekIso: string;
  status: string;
  startDate: string;
  endDate: string;
  kcalTarget: string;
  proteinGTarget: string;
  fatGTarget: string;
  carbsGTarget: string;
  days: PlanDayDto[];
}

export const fetchPlans = (userId: string) =>
  apiGet<{ items: PlanListItem[]; total: number }>(`/plans?userId=${encodeURIComponent(userId)}`);

export async function fetchPlan(userId: string, weekIso: string): Promise<WeekPlanDto | null> {
  try {
    return await apiGet<WeekPlanDto>(
      `/plans?userId=${encodeURIComponent(userId)}&weekIso=${encodeURIComponent(weekIso)}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
