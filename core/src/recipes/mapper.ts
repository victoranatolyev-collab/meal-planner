import { Prisma, RecipeSource } from '@prisma/client';
import type { LlmRecipe } from './schemas.js';

/**
 * Pure: один LLM-рецепт → `Prisma.RecipeCreateInput`.
 *
 * Важно: ингредиенты НЕ сопоставляются с каталогом здесь. Они сохраняются «как есть»
 * в `rawIngredients` (jsonb) в форме `RawIngredient` ({name, qty, unit, note?}) —
 * это контракт с scr-normalize-recipe (`core/src/normalization/normalizer.ts`),
 * который позже подхватит их, сделает fuzzy-match и заполнит recipe_ingredients.
 *
 * Флаги: is_relevant=true (найден поиском под профиль), is_normalized/is_approved=false.
 * meal-теги → recipe_tags (scope для правил BAN_TAG_IN_MEAL / REQUIRE_TAG_IN_MEAL).
 */
export function buildRecipeCreateInput(userId: string, recipe: LlmRecipe): Prisma.RecipeCreateInput {
  const mealTags = dedupe(recipe.mealTags);

  // Нормализуем форму ингредиентов под RawIngredient: drop undefined `note`,
  // чтобы в jsonb не попадали ключи со значением undefined.
  const rawIngredients = recipe.ingredients.map((ing) => ({
    name: ing.name,
    qty: ing.qty,
    unit: ing.unit,
    ...(ing.note ? { note: ing.note } : {}),
  }));

  return {
    user: { connect: { id: userId } },
    name: recipe.name,
    instructions: recipe.instructions,
    source: RecipeSource.LLM,
    isRelevant: true,
    isNormalized: false,
    isApproved: false,
    rawIngredients: rawIngredients as unknown as Prisma.InputJsonValue,
    ...(mealTags.length > 0
      ? { tags: { create: mealTags.map((tagName) => ({ tagName })) } }
      : {}),
  };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}
