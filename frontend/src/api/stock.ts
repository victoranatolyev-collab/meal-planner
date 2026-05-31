import { apiGet, apiPost, apiDelete } from './client';

export interface StockLineDto {
  ingredientId: string;
  baselineG: number;
  boughtG: number;
  consumedG: number;
  projectedG: number;
}

export const fetchStock = (userId: string) =>
  apiGet<{ lines: StockLineDto[]; asOf: string }>(`/stock?userId=${encodeURIComponent(userId)}`);

// --- Базовый запас (StockItem) — инвентаризация ---

export interface StockBaselineItem {
  id: string;
  ingredientId: string;
  qtyG: number;
  ingredient: { name: string };
}

export const fetchStockBaseline = (userId: string) =>
  apiGet<{ items: StockBaselineItem[]; total: number }>(
    `/stock-items?userId=${encodeURIComponent(userId)}`,
  );

export const upsertStockItem = (userId: string, ingredientId: string, qtyG: number) =>
  apiPost<{ id?: string; deleted?: boolean }>('/stock-items', { userId, ingredientId, qtyG });

export const deleteStockItem = (userId: string, ingredientId: string) =>
  apiDelete(
    `/stock-items?userId=${encodeURIComponent(userId)}&ingredientId=${encodeURIComponent(ingredientId)}`,
  );
