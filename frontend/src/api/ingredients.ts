import { apiGet } from './client';

export interface IngredientDto {
  id: string;
  name: string;
  source: string;
  pricePer100g: string | null;
  unit: string;
  kcal100g: string | null;
  protein100g: string | null;
  fat100g: string | null;
  carbs100g: string | null;
}

/** Все ингредиенты (для маппинга id → имя на странице остатков). limit=200 — максимум API. */
export const fetchIngredients = () =>
  apiGet<{ items: IngredientDto[]; total: number }>('/ingredients?limit=200');

/** Поиск ингредиентов по подстроке имени (для пикера в форме блюда). */
export const searchIngredients = (q: string) =>
  apiGet<{ items: IngredientDto[]; total: number }>(
    `/ingredients?q=${encodeURIComponent(q)}&limit=20`,
  );
