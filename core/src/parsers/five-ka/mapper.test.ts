import { describe, it, expect } from 'vitest';
import { Prisma, IngredientSource } from '@prisma/client';
import { mapFiveKaToIngredient } from './mapper.js';
import type { FiveKaProduct } from './types.js';

describe('mapFiveKaToIngredient', () => {
  it('маппит позицию с полным КБЖУ и ценой', () => {
    const product: FiveKaProduct = {
      plu: 4210936,
      name: "Чипсы картофельные Lay's Краб 140г",
      uom: 'шт',
      weight: { label: '140 г', grams: 140 },
      prices: { regular: 179.99, discount: null },
      kbju: { kcal: 520, protein: 6, fat: 32, carbs: 53 },
    };

    const result = mapFiveKaToIngredient(product);

    expect(result.name).toBe("Чипсы картофельные Lay's Краб 140г");
    expect(result.source).toBe(IngredientSource.FIVEKA);
    expect(result.externalCode).toBe('4210936');
    expect(result.kcal100g).toBeInstanceOf(Prisma.Decimal);
    expect((result.kcal100g as Prisma.Decimal).toNumber()).toBe(520);
    expect((result.protein100g as Prisma.Decimal).toNumber()).toBe(6);
    expect(result.weightG).toBe(140);
    expect(result.packSize).toBe('140 г');
    expect(result.unit).toBe('шт');
    // price/100g = 179.99 / 140 * 100 ≈ 128.56
    expect((result.pricePer100g as Prisma.Decimal).toNumber()).toBeCloseTo(128.56, 2);
  });

  it('обрабатывает позицию без КБЖУ (все null)', () => {
    const product: FiveKaProduct = {
      plu: 9000999,
      name: 'Хлеб без КБЖУ',
      uom: 'шт',
      weight: { label: '400 г', grams: 400 },
      prices: { regular: 49, discount: null },
      kbju: { kcal: null, protein: null, fat: null, carbs: null },
    };

    const result = mapFiveKaToIngredient(product);

    expect(result.kcal100g).toBeNull();
    expect(result.protein100g).toBeNull();
    expect(result.fat100g).toBeNull();
    expect(result.carbs100g).toBeNull();
    // но цена считается, КБЖУ её не блокирует
    expect((result.pricePer100g as Prisma.Decimal).toNumber()).toBeCloseTo(12.25, 2);
  });

  it('пропускает price_per_100g когда нет цены или веса', () => {
    const product: FiveKaProduct = {
      plu: 1,
      name: 'Без цены',
      weight: { grams: 100 },
      prices: { regular: null },
    };

    expect(mapFiveKaToIngredient(product).pricePer100g).toBeNull();

    const product2: FiveKaProduct = {
      plu: 2,
      name: 'Без веса',
      weight: { grams: null },
      prices: { regular: 100 },
    };
    expect(mapFiveKaToIngredient(product2).pricePer100g).toBeNull();
  });

  it('единица измерения по умолчанию шт, packSize null если нет label', () => {
    const product: FiveKaProduct = {
      plu: 3,
      name: 'Без uom',
    };
    const result = mapFiveKaToIngredient(product);
    expect(result.unit).toBe('шт');
    expect(result.packSize).toBeNull();
    expect(result.weightG).toBeNull();
  });
});
