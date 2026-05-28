import type { IngredientSource } from '@prisma/client';

/** Позиция корзины с ценой для формирования заказа. */
export interface CartItemForOrder {
  ingredientId: string;
  qtyG: number;
  shop: IngredientSource;
  pricePer100g: number | null;
}

/** Черновик заказа (один на магазин). */
export interface OrderDraft {
  shop: IngredientSource;
  items: Array<{ ingredientId: string; qtyG: number; priceRub: number | null }>;
  totalRub: number; // сумма известных цен позиций
}
