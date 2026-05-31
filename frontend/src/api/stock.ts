import { apiGet } from './client';

export interface StockLineDto {
  ingredientId: string;
  baselineG: number;
  boughtG: number;
  consumedG: number;
  projectedG: number;
}

export const fetchStock = (userId: string) =>
  apiGet<{ lines: StockLineDto[]; asOf: string }>(`/stock?userId=${encodeURIComponent(userId)}`);
