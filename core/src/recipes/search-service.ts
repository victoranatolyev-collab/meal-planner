import pino from 'pino';
import { prisma } from '../db.js';
import { runLlmJob } from './llm-client.js';
import { buildRecipeCreateInput } from './mapper.js';
import {
  searchRecipesInputSchema,
  searchRecipesOutputSchema,
  type SearchRecipesRequest,
} from './schemas.js';

const logger = pino({ name: 'recipes:search' });

export interface SearchRecipesResult {
  created: Array<{ id: string; name: string; mealTags: string[] }>;
  count: number;
}

/**
 * scr-search-recipes: генерирует N рецептов под профиль пользователя через llm-service
 * и сохраняет каждый как `Recipe` с `is_relevant=true` (source=LLM, ещё не нормализован).
 *
 * Поток: REST `POST /api/recipes/search` (или Telegram-агент) → эта функция →
 *   llm-service (`POST /jobs` kind=search-recipes → wait) → persist.
 * Downstream пайплайн: scr-normalize-recipe → scr-validate-recipes.
 *
 * Контракт: ARCHITECTURE §10.4 (HTTP job lifecycle) + §9.4 (LLM-код только в llm-service).
 * Реальная Claude-генерация зависит от `LLM_MODE=api` в llm-service; в dev/тестах
 * llm-service отдаёт фикстуры (`LLM_MODE=stub`) — пайплайн работает end-to-end и так.
 */
export async function searchRecipes(req: SearchRecipesRequest): Promise<SearchRecipesResult> {
  // Subset, который уходит в llm-service (без userId — профиль подмешивает сам сервис).
  const input = searchRecipesInputSchema.parse(req);

  // Гарантируем существование пользователя до похода в LLM (FK + быстрый fail).
  await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });

  const output = await runLlmJob({
    kind: 'search-recipes',
    input,
    userId: req.userId,
    responseSchema: searchRecipesOutputSchema,
  });

  // Атомарно: все рецепты одной транзакцией (частичный импорт недопустим).
  const rows = await prisma.$transaction(
    output.recipes.map((recipe) =>
      prisma.recipe.create({
        data: buildRecipeCreateInput(req.userId, recipe),
        include: { tags: true },
      }),
    ),
  );

  const created = rows.map((row) => ({
    id: row.id,
    name: row.name,
    mealTags: row.tags.map((t) => t.tagName),
  }));

  logger.info(
    { userId: req.userId, requested: input.count, created: created.length },
    'recipes searched',
  );

  return { created, count: created.length };
}
