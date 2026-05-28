import { describe, it, expect } from 'vitest';
import { computeCorrection } from './compute.js';
import type { Macros } from './types.js';

const T: Macros = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 200 };

describe('computeCorrection', () => {
  it('remaining = target − actual', () => {
    const days = computeCorrection({
      dailyTarget: T,
      dates: ['2026-05-29'],
      actualByDate: new Map([['2026-05-29', { kcal: 1200, proteinG: 90, fatG: 30, carbsG: 140 }]]),
    });
    expect(days[0]?.remaining).toEqual({ kcal: 800, proteinG: 60, fatG: 30, carbsG: 60 });
  });

  it('день без факта → actual 0, remaining = target', () => {
    const days = computeCorrection({ dailyTarget: T, dates: ['2026-05-29'], actualByDate: new Map() });
    expect(days[0]?.actual).toEqual({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
    expect(days[0]?.remaining).toEqual(T);
  });

  it('перебор → remaining < 0', () => {
    const days = computeCorrection({
      dailyTarget: T,
      dates: ['2026-05-29'],
      actualByDate: new Map([['2026-05-29', { kcal: 2500, proteinG: 0, fatG: 0, carbsG: 0 }]]),
    });
    expect(days[0]?.remaining.kcal).toBe(-500);
  });

  it('несколько дней', () => {
    const days = computeCorrection({
      dailyTarget: T,
      dates: ['2026-05-29', '2026-05-30'],
      actualByDate: new Map(),
    });
    expect(days).toHaveLength(2);
  });
});
