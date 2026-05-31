import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { recipeUpdateSchema, updateRecipe, deleteRecipe } from 'core';

/**
 * PATCH /api/recipes/:id — обновить блюдо (поля частично; tags/ingredients пересоздаются если переданы).
 * DELETE /api/recipes/:id — удалить блюдо (ссылки из plan_meal_items снимаются; дневник через SetNull).
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  let input;
  try {
    input = recipeUpdateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }
  try {
    const result = await updateRecipe(id, input);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const result = await deleteRecipe(id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
