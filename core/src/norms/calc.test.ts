import { describe, it, expect } from 'vitest';
import { calcNorms } from './calc.js';
import type { NormsInput } from './types.js';

// Reference: мужчина 24 г, 190 см, 86 кг (data/user_profile.json).
const base: NormsInput = {
  sex: 'MALE',
  ageYears: 24,
  heightCm: 190,
  weightKg: 86,
  activityLevel: 'MODERATE',
  goal: 'MAINTAIN',
};

describe('calcNorms', () => {
  it('BMR по Mifflin-St Jeor (male): 10·86 + 6.25·190 − 5·24 + 5 = 1932.5', () => {
    expect(calcNorms(base).bmr).toBe(1933);
  });

  it('female BMR на 166 ниже male (разница sex-константы +5 vs −161)', () => {
    const male = calcNorms(base);
    const female = calcNorms({ ...base, sex: 'FEMALE' });
    expect(male.bmr - female.bmr).toBe(166);
  });

  it('TDEE = BMR × множитель активности (MODERATE = 1.55)', () => {
    const r = calcNorms(base);
    expect(r.breakdown.activityMultiplier).toBe(1.55);
    expect(r.tdee).toBe(Math.round(1932.5 * 1.55));
  });

  it('цель: CUT < MAINTAIN < GAIN по калориям', () => {
    const cut = calcNorms({ ...base, goal: 'CUT' }).kcalPerDay;
    const maintain = calcNorms({ ...base, goal: 'MAINTAIN' }).kcalPerDay;
    const gain = calcNorms({ ...base, goal: 'GAIN' }).kcalPerDay;
    expect(cut).toBeLessThan(maintain);
    expect(maintain).toBeLessThan(gain);
  });

  it('белок = proteinGPerKg × вес (default 1.8 → 155 г)', () => {
    const r = calcNorms(base);
    expect(r.proteinGPerDay).toBe(Math.round(1.8 * 86));
    expect(r.breakdown.proteinGPerKg).toBe(1.8);
  });

  it('override proteinGPerKg = 2.0', () => {
    expect(calcNorms({ ...base, proteinGPerKg: 2.0 }).proteinGPerDay).toBe(Math.round(2.0 * 86));
  });

  it('жир = fatPercent (default 30%) от калорийности', () => {
    const r = calcNorms(base);
    expect(r.breakdown.fatPercent).toBe(0.3);
    expect(r.fatGPerDay).toBe(Math.round((r.kcalPerDay * 0.3) / 9));
  });

  it('баланс: сумма макро-калорий ≈ kcalPerDay (±6 ккал на округление)', () => {
    const r = calcNorms(base);
    const macroKcal = r.proteinGPerDay * 4 + r.fatGPerDay * 9 + r.carbsGPerDay * 4;
    expect(Math.abs(macroKcal - r.kcalPerDay)).toBeLessThanOrEqual(6);
  });
});
