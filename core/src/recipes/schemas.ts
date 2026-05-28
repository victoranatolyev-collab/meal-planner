import { z } from 'zod';

/**
 * Zod-схемы домена recipes (scr-search-recipes).
 *
 * Эти схемы — контракт `core` на границе с `llm-service` (HTTP). Они намеренно
 * дублируют схемы из `llm-service/src/jobs/types.ts`: каждая сторона валидирует
 * независимо на своей стороне сервисной границы (core НЕ импортирует из llm-service).
 *
 * Единый источник для REST endpoint + Telegram-агент tool (ARCHITECTURE §4.2, §9.2).
 */

/** Один ингредиент в ответе LLM — сырой, ещё не сопоставлен с каталогом. */
export const llmRecipeIngredientSchema = z.object({
  name: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  note: z.string().optional(),
});
export type LlmRecipeIngredient = z.infer<typeof llmRecipeIngredientSchema>;

/** Один рецепт в ответе LLM. */
export const llmRecipeSchema = z.object({
  name: z.string().min(1).max(200),
  instructions: z.string(),
  ingredients: z.array(llmRecipeIngredientSchema).min(1).max(30),
  mealTags: z.array(z.string().min(1)).default([]),
});
export type LlmRecipe = z.infer<typeof llmRecipeSchema>;

/** Полный ответ llm-service на job `search-recipes`. */
export const searchRecipesOutputSchema = z.object({
  recipes: z.array(llmRecipeSchema).min(1).max(20),
});
export type SearchRecipesOutput = z.infer<typeof searchRecipesOutputSchema>;

/**
 * Input для llm-service job `search-recipes`. Профиль/правила НЕ передаём отсюда —
 * их подмешивает сам llm-service в system prompt (изоляция контекста, §10.13).
 */
export const searchRecipesInputSchema = z.object({
  count: z.number().int().min(1).max(20).default(5),
  mealTags: z.array(z.string().min(1)).max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export type SearchRecipesInput = z.infer<typeof searchRecipesInputSchema>;

/**
 * Запрос к service-функции `searchRecipes` (из REST endpoint или агента).
 * `userId` обязателен (auth deferred — пока приходит из тела запроса).
 */
export const searchRecipesRequestSchema = z.object({
  userId: z.string().uuid(),
  count: z.number().int().min(1).max(20).optional(),
  mealTags: z.array(z.string().min(1)).max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export type SearchRecipesRequest = z.infer<typeof searchRecipesRequestSchema>;
