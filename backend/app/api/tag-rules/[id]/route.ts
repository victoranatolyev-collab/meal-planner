import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { tagRuleUpdateSchema, updateTagRule, deleteTagRule } from 'core';

/**
 * PATCH /api/tag-rules/:id
 * Body: partial { ruleKind?, tagName?, mealTag?, quantity?, exceptionTag?, reason?, isActive? }
 * (nullable-поля можно явно обнулить через null). Ответ: 200 TagRule | 404 not_found.
 *
 * DELETE /api/tag-rules/:id → 204 No Content | 404 not_found.
 *
 * NB (Next.js 15): `params` — Promise, его надо await.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let patch;
  try {
    patch = tagRuleUpdateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const updated = await updateTagRule(id, patch);
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const deleted = await deleteTagRule(id);
  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
