import { describe, it, expect } from 'vitest';
import {
  searchRecipesInputSchema,
  searchRecipesRequestSchema,
  searchRecipesOutputSchema,
} from './schemas.js';

describe('searchRecipesInputSchema', () => {
  it('применяет default count=5', () => {
    const parsed = searchRecipesInputSchema.parse({});
    expect(parsed.count).toBe(5);
  });

  it('strips лишние ключи (например userId)', () => {
    const parsed = searchRecipesInputSchema.parse({ count: 3, userId: 'x' });
    expect(parsed).toEqual({ count: 3 });
  });

  it('отвергает count вне 1..20', () => {
    expect(searchRecipesInputSchema.safeParse({ count: 0 }).success).toBe(false);
    expect(searchRecipesInputSchema.safeParse({ count: 21 }).success).toBe(false);
  });
});

describe('searchRecipesRequestSchema', () => {
  it('требует userId как uuid', () => {
    expect(searchRecipesRequestSchema.safeParse({ userId: 'not-a-uuid' }).success).toBe(false);
    expect(
      searchRecipesRequestSchema.safeParse({ userId: '11111111-1111-1111-1111-111111111111' })
        .success,
    ).toBe(true);
  });
});

describe('searchRecipesOutputSchema', () => {
  const validRecipe = {
    name: 'Творог с ягодами',
    instructions: 'Смешать.',
    ingredients: [{ name: 'творог 5%', qty: 200, unit: 'г' }],
    mealTags: ['breakfast'],
  };

  it('валидирует корректный ответ + проставляет mealTags default []', () => {
    const parsed = searchRecipesOutputSchema.parse({
      recipes: [{ ...validRecipe, mealTags: undefined }],
    });
    expect(parsed.recipes[0]!.mealTags).toEqual([]);
  });

  it('отвергает пустой список рецептов', () => {
    expect(searchRecipesOutputSchema.safeParse({ recipes: [] }).success).toBe(false);
  });

  it('отвергает рецепт без ингредиентов', () => {
    expect(
      searchRecipesOutputSchema.safeParse({ recipes: [{ ...validRecipe, ingredients: [] }] })
        .success,
    ).toBe(false);
  });

  it('отвергает ингредиент с неположительным qty', () => {
    expect(
      searchRecipesOutputSchema.safeParse({
        recipes: [{ ...validRecipe, ingredients: [{ name: 'x', qty: 0, unit: 'г' }] }],
      }).success,
    ).toBe(false);
  });
});
