import { describe, it, expect } from 'vitest';
import { resolveDraftToApproved, type ApprovedRecipe } from './resolve.js';
import type { DraftDay } from './schemas.js';

const pool: ApprovedRecipe[] = [
  { id: 'real-1', name: 'A' },
  { id: 'real-2', name: 'B' },
];

function day(recipeIds: string[]): DraftDay {
  return {
    date: '2026-05-25',
    meals: [
      {
        name: 'Обед',
        mealTags: [],
        items: recipeIds.map((recipeId) => ({
          recipeId,
          portionFactor: 1,
          fromStock: false,
          tail: false,
        })),
      },
    ],
  };
}

const ids = (r: { days: DraftDay[] }) => r.days[0]!.meals[0]!.items.map((i) => i.recipeId);

describe('resolveDraftToApproved', () => {
  it('оставляет известные recipeId без изменений (0 замен)', () => {
    const r = resolveDraftToApproved([day(['real-1', 'real-2'])], pool);
    expect(r.substitutions).toBe(0);
    expect(ids(r)).toEqual(['real-1', 'real-2']);
  });

  it('заменяет неизвестные recipeId round-robin из пула', () => {
    const r = resolveDraftToApproved([day(['ph-1', 'ph-2', 'ph-3'])], pool);
    expect(r.substitutions).toBe(3);
    expect(ids(r)).toEqual(['real-1', 'real-2', 'real-1']);
  });

  it('смешанный: известные сохраняются, неизвестные заменяются', () => {
    const r = resolveDraftToApproved([day(['real-2', 'nope'])], pool);
    expect(r.substitutions).toBe(1);
    expect(ids(r)).toEqual(['real-2', 'real-1']);
  });

  it('бросает на пустом пуле', () => {
    expect(() => resolveDraftToApproved([day(['x'])], [])).toThrow();
  });
});
