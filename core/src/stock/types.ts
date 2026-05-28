/** Строка проекции остатков по ингредиенту. */
export interface StockProjectionLine {
  ingredientId: string;
  baselineG: number; // текущий StockItem (последняя инвентаризация)
  boughtG: number; // куплено (order_history)
  consumedG: number; // съедено (food_diary → recipe_ingredients × portionFactor)
  projectedG: number; // baseline + bought − consumed (может быть < 0 = дефицит)
}
