import { apiGet, apiPost } from './client';

export interface DiaryEntryDto {
  id: string;
  eatenAt: string;
  recipeId: string | null;
  customName: string | null;
  portionFactor: string;
  kcal: string | null;
  proteinG: string | null;
  fatG: string | null;
  carbsG: string | null;
  mealName: string | null;
  note: string | null;
}

export interface DiaryCreateInput {
  userId: string;
  recipeId?: string;
  customName?: string;
  portionFactor?: number;
  kcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  mealName?: string;
  note?: string;
}

export const fetchDiary = (userId: string) =>
  apiGet<{ items: DiaryEntryDto[]; total: number }>(`/diary?userId=${encodeURIComponent(userId)}`);

export const createDiaryEntry = (input: DiaryCreateInput) =>
  apiPost<DiaryEntryDto>('/diary', input);
