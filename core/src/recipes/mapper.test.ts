import { describe, it, expect } from 'vitest';
import { RecipeSource, Prisma } from '@prisma/client';
import { buildRecipeCreateInput } from './mapper.js';
import type { LlmRecipe } from './schemas.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';

function recipe(overrides: Partial<LlmRecipe> = {}): LlmRecipe {
  return {
    name: 'Куриная грудка с гречкой',
    instructions: 'Сварить гречку, обжарить грудку.',
    ingredients: [
      { name: 'куриная грудка', qty: 250, unit: 'г' },
      { name: 'гречка', qty: 80, unit: 'г', note: 'сухая' },
    ],
    mealTags: ['lunch', 'high_protein'],
    ...overrides,
  };
}

describe('buildRecipeCreateInput', () => {
  it('ставит source=LLM и is_relevant=true, остальные флаги false', () => {
    const data = buildRecipeCreateInput(USER_ID, recipe());
    expect(data.source).toBe(RecipeSource.LLM);
    expect(data.isRelevant).toBe(true);
    expect(data.isNormalized).toBe(false);
    expect(data.isApproved).toBe(false);
  });

  it('подключает пользователя через connect', () => {
    const data = buildRecipeCreateInput(USER_ID, recipe());
    expect(data.user).toEqual({ connect: { id: USER_ID } });
  });

  it('сохраняет ингредиенты в rawIngredients в форме RawIngredient', () => {
    const data = buildRecipeCreateInput(USER_ID, recipe());
    const raw = data.rawIngredients as unknown as Array<Record<string, unknown>>;
    expect(raw).toHaveLength(2);
    expect(raw[0]).toEqual({ name: 'куриная грудка', qty: 250, unit: 'г' });
    expect(raw[1]).toEqual({ name: 'гречка', qty: 80, unit: 'г', note: 'сухая' });
  });

  it('не кладёт ключ note, если его нет (без undefined в jsonb)', () => {
    const data = buildRecipeCreateInput(USER_ID, recipe());
    const raw = data.rawIngredients as unknown as Array<Record<string, unknown>>;
    expect(Object.prototype.hasOwnProperty.call(raw[0]!, 'note')).toBe(false);
  });

  it('создаёт recipe_tags из mealTags', () => {
    const data = buildRecipeCreateInput(USER_ID, recipe());
    const tags = data.tags as Prisma.RecipeTagCreateNestedManyWithoutRecipeInput;
    expect(tags.create).toEqual([{ tagName: 'lunch' }, { tagName: 'high_protein' }]);
  });

  it('дедуплицирует mealTags', () => {
    const data = buildRecipeCreateInput(USER_ID, recipe({ mealTags: ['lunch', 'lunch', 'iron_meal'] }));
    const tags = data.tags as Prisma.RecipeTagCreateNestedManyWithoutRecipeInput;
    expect(tags.create).toEqual([{ tagName: 'lunch' }, { tagName: 'iron_meal' }]);
  });

  it('не добавляет tags, когда mealTags пуст', () => {
    const data = buildRecipeCreateInput(USER_ID, recipe({ mealTags: [] }));
    expect(data.tags).toBeUndefined();
  });
});
