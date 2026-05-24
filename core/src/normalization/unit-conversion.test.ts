import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { convertToGramsWith } from './unit-conversion.js';

// Хелперы для тестов
type ConvRow = {
  unit: string;
  gramsPerUnit: Prisma.Decimal;
  ingredientTag: string | null;
};

const conv = (unit: string, grams: number, tag: string | null = null): ConvRow => ({
  unit,
  gramsPerUnit: new Prisma.Decimal(grams),
  ingredientTag: tag,
});

const baseConversions: ConvRow[] = [
  conv('г', 1),
  conv('кг', 1000),
  conv('мл', 1),
  conv('л', 1000),
  conv('столовая ложка', 15),
  conv('чайная ложка', 5),
  conv('шт', 50, 'egg'),
];

describe('convertToGramsWith', () => {
  it('grams 1:1 для г', () => {
    const r = convertToGramsWith(baseConversions, 250, 'г');
    expect(r.grams).toBe(250);
    expect(r.matchedRow).toBe('universal');
  });

  it('кг → 1000', () => {
    const r = convertToGramsWith(baseConversions, 1.5, 'кг');
    expect(r.grams).toBe(1500);
  });

  it('столовая ложка → 15г', () => {
    const r = convertToGramsWith(baseConversions, 2, 'столовая ложка');
    expect(r.grams).toBe(30);
  });

  it('case-insensitive + trim', () => {
    const r = convertToGramsWith(baseConversions, 1, '  КГ ');
    expect(r.grams).toBe(1000);
  });

  it('шт для egg-тэга → 50г', () => {
    const r = convertToGramsWith(baseConversions, 3, 'шт', ['egg', 'protein']);
    expect(r.grams).toBe(150);
    expect(r.matchedRow).toBe('tag-specific');
  });

  it('шт БЕЗ egg-тэга → null + reason', () => {
    const r = convertToGramsWith(baseConversions, 1, 'шт', ['apple']);
    expect(r.grams).toBeNull();
    expect(r.reason).toMatch(/unit 'шт' не найден/);
  });

  it('неизвестный unit → null + reason', () => {
    const r = convertToGramsWith(baseConversions, 1, 'oz');
    expect(r.grams).toBeNull();
    expect(r.reason).toMatch(/unit 'oz' не найден/);
  });

  it('tag-specific приоритетнее universal (если оба подходят)', () => {
    const conversions = [
      conv('шт', 100), // universal default
      conv('шт', 50, 'egg'), // tag-specific для egg
    ];
    const eggResult = convertToGramsWith(conversions, 2, 'шт', ['egg']);
    expect(eggResult.grams).toBe(100); // 2 * 50 = 100 (по tag-specific)

    const otherResult = convertToGramsWith(conversions, 2, 'шт', ['apple']);
    expect(otherResult.grams).toBe(200); // fallback universal 2 * 100
  });
});
