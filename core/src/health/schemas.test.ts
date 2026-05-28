import { describe, it, expect } from 'vitest';
import {
  anthropometryCreateSchema,
  labTestCreateSchema,
  moodLogCreateSchema,
  trainingLogCreateSchema,
  healthListQuerySchema,
} from './schemas.js';

const UID = '11111111-1111-1111-1111-111111111111';

describe('anthropometryCreateSchema', () => {
  const valid = { userId: UID, sex: 'MALE', ageYears: 24, heightCm: 190, weightKg: 86 };

  it('валидный минимум', () => {
    expect(anthropometryCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('coerce measuredAt из ISO-строки в Date', () => {
    const p = anthropometryCreateSchema.parse({ ...valid, measuredAt: '2026-05-01' });
    expect(p.measuredAt).toBeInstanceOf(Date);
  });
  it('отвергает неизвестный sex', () => {
    expect(anthropometryCreateSchema.safeParse({ ...valid, sex: 'X' }).success).toBe(false);
  });
  it('отвергает неположительный вес', () => {
    expect(anthropometryCreateSchema.safeParse({ ...valid, weightKg: -1 }).success).toBe(false);
  });
});

describe('labTestCreateSchema', () => {
  it('isFlagged default false', () => {
    const p = labTestCreateSchema.parse({ userId: UID, analyte: 'hemoglobin', value: 110, unit: 'g/L' });
    expect(p.isFlagged).toBe(false);
  });
  it('требует analyte + unit', () => {
    expect(labTestCreateSchema.safeParse({ userId: UID, value: 110 }).success).toBe(false);
  });
});

describe('trainingLogCreateSchema', () => {
  it('требует kind + положительный durationMin', () => {
    expect(trainingLogCreateSchema.safeParse({ userId: UID, kind: 'strength', durationMin: 90 }).success).toBe(true);
    expect(trainingLogCreateSchema.safeParse({ userId: UID, kind: 'strength', durationMin: 0 }).success).toBe(false);
  });
});

describe('moodLogCreateSchema', () => {
  it('symptoms default []', () => {
    expect(moodLogCreateSchema.parse({ userId: UID }).symptoms).toEqual([]);
  });
  it('mood в диапазоне 1..10', () => {
    expect(moodLogCreateSchema.safeParse({ userId: UID, mood: 11 }).success).toBe(false);
  });
});

describe('healthListQuerySchema', () => {
  it('coerce limit + default 50', () => {
    expect(healthListQuerySchema.parse({ userId: UID }).limit).toBe(50);
    expect(healthListQuerySchema.parse({ userId: UID, limit: '10' }).limit).toBe(10);
  });
});
