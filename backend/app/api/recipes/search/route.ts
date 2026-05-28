import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { searchRecipesRequestSchema, searchRecipes } from 'core';

/**
 * POST /api/recipes/search
 *
 * scr-search-recipes: генерирует N рецептов под профиль через llm-service и сохраняет
 * их с is_relevant=true. Тонкий wrapper над `core.searchRecipes`.
 *
 * Body: { userId: uuid, count?: 1..20, mealTags?: string[], notes?: string }
 * Ответ: 201 { created: [{ id, name, mealTags }], count }
 * Ошибки:
 *  - 400 invalid_json / invalid_body (Zod details)
 *  - 502 search_failed (llm-service недоступен / job failed)
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let req;
  try {
    req = searchRecipesRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await searchRecipes(req);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'search_failed', message }, { status: 502 });
  }
}
