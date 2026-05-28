import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { assembleCartRequestSchema, assembleCart } from 'core';

/**
 * POST /api/cart/assemble
 * Body: { userId, weekIso }
 * scr-assemble-cart: план недели − остатки → ACTIVE Cart с позициями (по shop).
 * Ответ: 201 { cartId, lines, byShop }. Ошибки: 400 invalid_*; 422 assemble_failed (нет/пуст план).
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
    req = assembleCartRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await assembleCart(req.userId, req.weekIso);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'assemble_failed', message }, { status: 422 });
  }
}
