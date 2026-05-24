/**
 * Сырой ингредиент от LLM (или ручного ввода): имя + количество + единица + опц. примечание.
 * Сохраняется в Recipe.rawIngredients (jsonb) до нормализации.
 */
export interface RawIngredient {
  name: string;
  qty: number;
  unit: string;
  note?: string;
}

/**
 * Результат сопоставления одного raw-ингредиента с catalog.
 */
export interface MatchedIngredient {
  rawName: string;
  rawQty: number;
  rawUnit: string;
  ingredientId: string;
  matchedName: string;
  similarity: number;
  qtyG: number | null;
  warning: string | null;
}

/**
 * Итог нормализации одного рецепта.
 */
export interface NormalizationResult {
  recipeId: string;
  matched: MatchedIngredient[];
  unmatched: Array<{ rawName: string; reason: string }>;
  totals: {
    kcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  };
  warnings: string[];
}

/**
 * Конфиг fuzzy-match: минимальный similarity-порог.
 */
export interface MatchConfig {
  threshold: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  threshold: 0.3,
};
