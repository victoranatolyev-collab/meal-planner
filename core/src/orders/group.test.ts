import { describe, it, expect } from 'vitest';
import { groupCartIntoOrders } from './group.js';

describe('groupCartIntoOrders', () => {
  it('группирует позиции по магазину', () => {
    const drafts = groupCartIntoOrders([
      { ingredientId: 'i1', qtyG: 200, shop: 'FIVEKA', pricePer100g: 100 },
      { ingredientId: 'i2', qtyG: 100, shop: 'VV', pricePer100g: 50 },
      { ingredientId: 'i3', qtyG: 300, shop: 'FIVEKA', pricePer100g: null },
    ]);
    const byShop = Object.fromEntries(drafts.map((d) => [d.shop, d.items.length]));
    expect(byShop).toEqual({ FIVEKA: 2, VV: 1 });
  });

  it('priceRub = pricePer100g × qtyG / 100', () => {
    const drafts = groupCartIntoOrders([
      { ingredientId: 'i1', qtyG: 250, shop: 'FIVEKA', pricePer100g: 80 },
    ]);
    expect(drafts[0]?.items[0]?.priceRub).toBe(200);
  });

  it('priceRub = null, если цена неизвестна', () => {
    const drafts = groupCartIntoOrders([
      { ingredientId: 'i1', qtyG: 100, shop: 'FIVEKA', pricePer100g: null },
    ]);
    expect(drafts[0]?.items[0]?.priceRub).toBeNull();
  });

  it('totalRub = сумма известных цен (null игнорируется)', () => {
    const drafts = groupCartIntoOrders([
      { ingredientId: 'i1', qtyG: 200, shop: 'FIVEKA', pricePer100g: 100 },
      { ingredientId: 'i2', qtyG: 300, shop: 'FIVEKA', pricePer100g: null },
    ]);
    expect(drafts[0]?.totalRub).toBe(200);
  });
});
