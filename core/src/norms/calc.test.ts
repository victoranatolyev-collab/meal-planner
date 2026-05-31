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

  it('жир = fatGPerKg × вес (default 0.8 → 69 г при весе 86)', () => {
    const r = calcNorms(base);
    expect(r.breakdown.fatGPerKg).toBe(0.8);
    expect(r.fatGPerDay).toBe(Math.round(0.8 * 86));
  });

  it('override fatGPerKg = 1.0', () => {
    expect(calcNorms({ ...base, fatGPerKg: 1.0 }).fatGPerDay).toBe(Math.round(1.0 * 86));
  });

  it('баланс: сумма макро-калорий ≈ kcalPerDay (±6 ккал на округление)', () => {
    const r = calcNorms(base);
    const macroKcal = r.proteinGPerDay * 4 + r.fatGPerDay * 9 + r.carbsGPerDay * 4;
    expect(Math.abs(macroKcal - r.kcalPerDay)).toBeLessThanOrEqual(6);
  });
});

// Гранулярная модель активности (doctorushakov): шаги + силовые/нед + кардио/нед + TEF.
describe('calcNorms — гранулярная активность', () => {
  // Reference-входы пользователя (data/nutrition_norms.json): 7000 шагов, силовые 180 мин/нед.
  const granular: NormsInput = {
    sex: 'MALE',
    ageYears: 24,
    heightCm: 190,
    weightKg: 86,
    stepsPerDay: 7000,
    strengthMinutesPerWeek: 180,
    cardioMinutesPerWeek: 0,
    goal: 'MAINTAIN',
  };

  it('компоненты активности: шаги 7000×0.03=210, силовые 180×5/7≈129, кардио 0', () => {
    const b = calcNorms(granular).breakdown;
    expect(b.stepsKcal).toBe(210);
    expect(b.strengthKcal).toBe(Math.round((180 * 5) / 7)); // 129
    expect(b.cardioKcal).toBe(0);
    expect(b.activityMultiplier).toBeUndefined(); // не fallback-режим
  });

  it('TEF добавляется (tefKcal > 0) и TDEE > BMR + активность', () => {
    const r = calcNorms(granular);
    expect(r.breakdown.tefKcal!).toBeGreaterThan(0);
    // TDEE должен быть заметно выше «голого» BMR (1933) — за счёт активности и TEF.
    expect(r.tdee).toBeGreaterThan(2400);
    expect(r.tdee).toBeLessThan(2700);
  });

  it('больше кардио → выше TDEE', () => {
    const low = calcNorms(granular).tdee;
    const high = calcNorms({ ...granular, cardioMinutesPerWeek: 300 }).tdee;
    expect(high).toBeGreaterThan(low);
  });

  it('гранулярный режим имеет приоритет над activityLevel', () => {
    const withBoth = calcNorms({ ...granular, activityLevel: 'SEDENTARY' });
    expect(withBoth.breakdown.activityMultiplier).toBeUndefined();
    expect(withBoth.breakdown.stepsKcal).toBe(210);
  });

  it('TEF белка дороже углеводов: больше белок → выше TEF/TDEE', () => {
    const lowP = calcNorms({ ...granular, proteinGPerKg: 1.2 }).tdee;
    const highP = calcNorms({ ...granular, proteinGPerKg: 2.4 }).tdee;
    expect(highP).toBeGreaterThan(lowP);
  });
});
