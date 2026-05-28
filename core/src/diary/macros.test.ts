import { describe, it, expect } from 'vitest';
import { scaleMacros } from './macros.js';
import { diaryEntryCreateSchema } from './schemas.js';

const UID = '11111111-1111-1111-1111-111111111111';
const RID = '22222222-2222-2222-2222-222222222222';

describe('scaleMacros', () => {
  it('масштабирует на factor', () => {
    expect(scaleMacros({ kcal: 600, proteinG: 45, fatG: 15, carbsG: 70 }, 2)).toEqual({
      kcal: 1200,
      proteinG: 90,
      fatG: 30,
      carbsG: 140,
    });
  });

  it('null-safe (null остаётся null)', () => {
    expect(scaleMacros({ kcal: null, proteinG: 45, fatG: null, carbsG: null }, 1.5)).toEqual({
      kcal: null,
      proteinG: 67.5,
      fatG: null,
      carbsG: null,
    });
  });
});

describe('diaryEntryCreateSchema', () => {
  it('recipeId → ok, portionFactor default 1', () => {
    const p = diaryEntryCreateSchema.parse({ userId: UID, recipeId: RID });
    expect(p.portionFactor).toBe(1);
  });

  it('customName (ad-hoc) → ok', () => {
    expect(diaryEntryCreateSchema.safeParse({ userId: UID, customName: 'Snickers' }).success).toBe(true);
  });

  it('ни recipeId, ни customName → fail', () => {
    expect(diaryEntryCreateSchema.safeParse({ userId: UID }).success).toBe(false);
  });

  it('coerce eatenAt из ISO', () => {
    const p = diaryEntryCreateSchema.parse({ userId: UID, customName: 'X', eatenAt: '2026-05-01' });
    expect(p.eatenAt).toBeInstanceOf(Date);
  });
});
