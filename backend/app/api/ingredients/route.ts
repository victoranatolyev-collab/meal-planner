import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { listIngredientsQuerySchema, listIngredients } from 'core';

/**
 * GET /api/ingredients
 *
 * Список ингредиентов из каталога. Поддерживает пагинацию (limit/offset) и фильтр по source.
 *
 * Query params:
 *  - limit: 1..200, default 50
 *  - offset: ≥0, default 0
 *  - source: FIVEKA | TSEH | LL | VV | CUSTOM (optional)
 *  - q: text search по name (case-insensitive), optional
 *
 * Ответ: { items: Ingredient[], total: number, limit: number, offset: number }
 * Ошибки: 400 при невалидных params (с деталями Zod).
 */
export async function GET(request: NextRequest) {
  const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());

  let query;
  try {
    query = listIngredientsQuerySchema.parse(rawQuery);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'invalid_query',
          details: err.flatten(),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const result = await listIngredients(query);
  return NextResponse.json(result);
}
