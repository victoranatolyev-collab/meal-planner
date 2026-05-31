import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { userIdQuerySchema, listAgentHistory } from 'core';

/**
 * GET /api/agent/history?userId=<uuid> — последние реплики диалога с агентом
 * (chronological) для восстановления чата в UI. Ответ: { items }.
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
  const items = await listAgentHistory(query.userId);
  return NextResponse.json({ items });
}
