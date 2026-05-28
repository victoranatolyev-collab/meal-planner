import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { userIdQuerySchema, calcStock } from 'core';

/**
 * GET /api/stock?userId=<uuid>
 * scr-calc-stock: проекция остатков (baseline + куплено − съедено) по ингредиентам.
 * Ответ: 200 { lines: [{ ingredientId, baselineG, boughtG, consumedG, projectedG }], asOf }.
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

  const result = await calcStock(query.userId);
  return NextResponse.json(result);
}
