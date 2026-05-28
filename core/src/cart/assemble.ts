import type { IngredientSource } from '@prisma/client';
import type { CartLine, PlanItemRef, RecipeIngredientRef } from './types.js';

/**
 * Pure (scr-assemble-cart): план недели − остатки → строки корзины.
 *
 * 1. Аккумулируем нужные граммы по ингредиенту: для каждой позиции плана
 *    (recipe × portionFactor) суммируем qty_g ингредиентов рецепта × portionFactor.
 * 2. Вычитаем остатки (stock). Нужно = required − onHand; если ≤0 — не покупаем.
 * 3. qtyG округляем вверх (ceil). shop = источник ингредиента (группировка по магазину).
 */
export function assembleCartLines(args: {
  planItems: PlanItemRef[];
  recipeIngredients: Map<string, RecipeIngredientRef[]>;
  stockGrams: Map<string, number>;
}): CartLine[] {
  const required = new Map<string, { grams: number; shop: IngredientSource }>();

  for (const item of args.planItems) {
    const ings = args.recipeIngredients.get(item.recipeId) ?? [];
    for (const ing of ings) {
      const add = ing.qtyG * item.portionFactor;
      const prev = required.get(ing.ingredientId);
      if (prev) {
        prev.grams += add;
      } else {
        required.set(ing.ingredientId, { grams: add, shop: ing.shop });
      }
    }
  }

  const lines: CartLine[] = [];
  for (const [ingredientId, { grams, shop }] of required) {
    const onHand = args.stockGrams.get(ingredientId) ?? 0;
    const needed = grams - onHand;
    if (needed > 0) {
      lines.push({ ingredientId, qtyG: Math.ceil(needed), shop });
    }
  }
  return lines;
}
