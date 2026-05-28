import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { placeOrderRequestSchema, userIdQuerySchema, placeOrder, listOrders } from 'core';

/**
 * GET /api/orders?userId=<uuid> — история заказов { items, total }.
 *
 * POST /api/orders  body { userId }
 * scr-order-products: ACTIVE Cart → order_history (Order на магазин + позиции), cart → ORDERED.
 * Ответ: 201 { orders: [{ orderId, shop, items, totalRub }] }. Ошибки: 400; 422 order_failed.
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
  const items = await listOrders(query.userId);
  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let req;
  try {
    req = placeOrderRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await placeOrder(req.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'order_failed', message }, { status: 422 });
  }
}
