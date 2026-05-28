import type { IngredientSource } from '@prisma/client';
import type { CartItemForOrder, OrderDraft } from './types.js';

/**
 * Pure (scr-order-products): позиции корзины → черновики заказов по магазинам.
 * priceRub позиции = pricePer100g × qtyG / 100 (null если цена неизвестна).
 * totalRub магазина = сумма известных цен позиций.
 */
export function groupCartIntoOrders(items: CartItemForOrder[]): OrderDraft[] {
  const byShop = new Map<IngredientSource, OrderDraft>();

  for (const it of items) {
    const priceRub = it.pricePer100g !== null ? round2((it.pricePer100g * it.qtyG) / 100) : null;
    let draft = byShop.get(it.shop);
    if (!draft) {
      draft = { shop: it.shop, items: [], totalRub: 0 };
      byShop.set(it.shop, draft);
    }
    draft.items.push({ ingredientId: it.ingredientId, qtyG: it.qtyG, priceRub });
    if (priceRub !== null) draft.totalRub += priceRub;
  }

  for (const draft of byShop.values()) {
    draft.totalRub = round2(draft.totalRub);
  }
  return [...byShop.values()];
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
