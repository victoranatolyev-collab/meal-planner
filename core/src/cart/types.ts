import type { IngredientSource } from '@prisma/client';

/** Позиция плана: рецепт + множитель порции. */
export interface PlanItemRef {
  recipeId: string;
  portionFactor: number;
}

/** Ингредиент рецепта (нормализованный) + магазин-источник. */
export interface RecipeIngredientRef {
  ingredientId: string;
  qtyG: number;
  shop: IngredientSource;
}

/** Строка корзины к покупке. */
export interface CartLine {
  ingredientId: string;
  qtyG: number;
  shop: IngredientSource;
}
