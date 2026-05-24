import { describe, it, expect } from 'vitest';
import { listIngredientsQuerySchema } from './schemas.js';

describe('listIngredientsQuerySchema', () => {
  it('применяет дефолты для limit/offset', () => {
    const result = listIngredientsQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.source).toBeUndefined();
    expect(result.q).toBeUndefined();
  });

  it('coerce строковые числа в числа', () => {
    const result = listIngredientsQuerySchema.parse({ limit: '100', offset: '25' });
    expect(result.limit).toBe(100);
    expect(result.offset).toBe(25);
  });

  it('принимает корректные source enum значения', () => {
    const result = listIngredientsQuerySchema.parse({ source: 'FIVEKA' });
    expect(result.source).toBe('FIVEKA');
  });

  it('отклоняет неизвестный source', () => {
    expect(() => listIngredientsQuerySchema.parse({ source: 'OZON' })).toThrow();
  });

  it('отклоняет limit > 200 и limit < 1', () => {
    expect(() => listIngredientsQuerySchema.parse({ limit: 201 })).toThrow();
    expect(() => listIngredientsQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it('отклоняет негативный offset', () => {
    expect(() => listIngredientsQuerySchema.parse({ offset: -1 })).toThrow();
  });

  it('тримит пустые пробелы в q и требует мин. длину после trim', () => {
    expect(() => listIngredientsQuerySchema.parse({ q: '   ' })).toThrow();
    const ok = listIngredientsQuerySchema.parse({ q: '  курица  ' });
    expect(ok.q).toBe('курица');
  });
});
