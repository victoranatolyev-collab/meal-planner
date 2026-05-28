import { describe, it, expect } from 'vitest';
import { assembleCartLines } from './assemble.js';
import type { RecipeIngredientRef } from './types.js';

const ri = (m: Record<string, RecipeIngredientRef[]>) => new Map(Object.entries(m));

describe('assembleCartLines', () => {
  it('аккумулирует граммы по ингредиенту (рецепт × portionFactor)', () => {
    const lines = assembleCartLines({
      planItems: [
        { recipeId: 'r1', portionFactor: 1 },
        { recipeId: 'r1', portionFactor: 2 },
      ],
      recipeIngredients: ri({ r1: [{ ingredientId: 'i1', qtyG: 100, shop: 'FIVEKA' }] }),
      stockGrams: new Map(),
    });
    expect(lines).toEqual([{ ingredientId: 'i1', qtyG: 300, shop: 'FIVEKA' }]);
  });

  it('вычитает остатки', () => {
    const lines = assembleCartLines({
      planItems: [{ recipeId: 'r1', portionFactor: 1 }],
      recipeIngredients: ri({ r1: [{ ingredientId: 'i1', qtyG: 500, shop: 'FIVEKA' }] }),
      stockGrams: new Map([['i1', 200]]),
    });
    expect(lines).toEqual([{ ingredientId: 'i1', qtyG: 300, shop: 'FIVEKA' }]);
  });

  it('не покупает, если остатков достаточно', () => {
    const lines = assembleCartLines({
      planItems: [{ recipeId: 'r1', portionFactor: 1 }],
      recipeIngredients: ri({ r1: [{ ingredientId: 'i1', qtyG: 100, shop: 'FIVEKA' }] }),
      stockGrams: new Map([['i1', 200]]),
    });
    expect(lines).toEqual([]);
  });

  it('округляет дробные граммы вверх (ceil)', () => {
    const lines = assembleCartLines({
      planItems: [{ recipeId: 'r1', portionFactor: 0.8 }],
      recipeIngredients: ri({ r1: [{ ingredientId: 'i1', qtyG: 101, shop: 'FIVEKA' }] }),
      stockGrams: new Map(),
    });
    expect(lines[0]?.qtyG).toBe(Math.ceil(101 * 0.8));
  });

  it('сохраняет shop по каждому ингредиенту', () => {
    const lines = assembleCartLines({
      planItems: [{ recipeId: 'r1', portionFactor: 1 }],
      recipeIngredients: ri({
        r1: [
          { ingredientId: 'i1', qtyG: 100, shop: 'VV' },
          { ingredientId: 'i2', qtyG: 50, shop: 'TSEH' },
        ],
      }),
      stockGrams: new Map(),
    });
    const byId = Object.fromEntries(lines.map((l) => [l.ingredientId, l.shop]));
    expect(byId).toEqual({ i1: 'VV', i2: 'TSEH' });
  });
});
