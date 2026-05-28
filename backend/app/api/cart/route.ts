import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { userIdQuerySchema, getActiveCart } from 'core';

/**
 * GET /api/cart?userId=<uuid>
 * Активная корзина пользователя с позициями (+ инфо ингредиента). 404 если нет.
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

  const cart = await getActiveCart(query.userId);
  if (!cart) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(cart);
}
