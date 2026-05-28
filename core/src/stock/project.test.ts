import { describe, it, expect } from 'vitest';
import { projectStock } from './project.js';

const m = (o: Record<string, number>) => new Map(Object.entries(o));

describe('projectStock', () => {
  it('projectedG = baseline + bought − consumed', () => {
    const lines = projectStock({ baseline: m({ i1: 500 }), bought: m({ i1: 300 }), consumed: m({ i1: 200 }) });
    expect(lines).toEqual([
      { ingredientId: 'i1', baselineG: 500, boughtG: 300, consumedG: 200, projectedG: 600 },
    ]);
  });

  it('дефицит → projectedG < 0', () => {
    const lines = projectStock({ baseline: m({ i1: 100 }), bought: m({}), consumed: m({ i1: 250 }) });
    expect(lines[0]?.projectedG).toBe(-150);
  });

  it('объединяет ключи из всех источников (отсутствующее = 0)', () => {
    const lines = projectStock({ baseline: m({ i1: 100 }), bought: m({ i2: 50 }), consumed: m({ i3: 20 }) });
    const byId = Object.fromEntries(lines.map((l) => [l.ingredientId, l.projectedG]));
    expect(byId).toEqual({ i1: 100, i2: 50, i3: -20 });
  });
});
