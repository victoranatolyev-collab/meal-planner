import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  userIdQuerySchema,
  stockItemUpsertSchema,
  listStockBaseline,
  upsertStockItem,
  deleteStockItem,
} from 'core';

/**
 * GET    /api/stock-items?userId=<uuid>           — базовый запас (StockItem) + имя ингредиента.
 * POST   /api/stock-items { userId, ingredientId, qtyG }  — upsert запаса (qtyG=0 → удалить).
 * DELETE /api/stock-items?userId=&ingredientId=   — удалить позицию запаса.
 * Базовый запас = слагаемое baseline в проекции остатков.
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
  const items = await listStockBaseline(query.userId);
  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  let input;
  try {
    input = stockItemUpsertSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }
  const result = await upsertStockItem(input);
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const userId = raw.userId;
  const ingredientId = raw.ingredientId;
  if (!userId || !ingredientId) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const result = await deleteStockItem(userId, ingredientId);
  return NextResponse.json(result);
}
