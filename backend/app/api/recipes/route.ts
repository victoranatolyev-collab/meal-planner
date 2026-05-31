import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { userIdQuerySchema, listRecipes, recipeCreateSchema, createRecipe } from 'core';

/**
 * GET /api/recipes?userId=<uuid>[&all=true]
 * Список рецептов пользователя. По умолчанию — ПУЛ планировщика (approved+normalized):
 * именно из этих блюд собирается план недели. `all=true` — все рецепты с флагами.
 * Ответ: 200 { items, total }.
 */
export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  let query;
  try {
    query = userIdQuerySchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_query', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const includeAll = raw.all === 'true';
  const items = await listRecipes(query.userId, includeAll);
  return NextResponse.json({ items, total: items.length });
}

/**
 * POST /api/recipes — создать блюдо вручную.
 * Body: { userId, name, instructions?, tags[], kcal?..., ingredients[{name,qtyG}], isApproved?, isNormalized? }
 * Ответ: 201 { id }. Ошибки: 400 invalid_*.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  let input;
  try {
    input = recipeCreateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }
  const result = await createRecipe(input);
  return NextResponse.json(result, { status: 201 });
}
