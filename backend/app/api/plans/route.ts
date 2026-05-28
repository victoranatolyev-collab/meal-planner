import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  generateWeekPlanRequestSchema,
  getWeekPlanQuerySchema,
  userIdQuerySchema,
  generateWeekPlan,
  getWeekPlan,
  listWeekPlans,
} from 'core';

/**
 * GET /api/plans?userId=<uuid>[&weekIso=YYYY-Www]
 *  - без weekIso → список планов пользователя { items, total }
 *  - с weekIso   → дерево плана (days → meals → items + рецепт-инфо); 404 если нет
 *
 * POST /api/plans
 * Body: { userId, weekIso, startDate (YYYY-MM-DD), dayCount?, dayTypes? }
 * scr-calc-week-plan: генерирует план через llm-service + greedy resolve, persist.
 * Ответ: 201 { weekPlanId, weekIso, days, meals, items, substitutions }.
 * Ошибки: 400 invalid_*; 422 generate_failed (нет targets/recipes или llm-service недоступен).
 */
export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());

  // Список планов (без weekIso).
  if (raw.weekIso === undefined) {
    let q;
    try {
      q = userIdQuerySchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: 'invalid_query', details: err.flatten() }, { status: 400 });
      }
      throw err;
    }
    const items = await listWeekPlans(q.userId);
    return NextResponse.json({ items, total: items.length });
  }

  // Детальное дерево (с weekIso).
  let query;
  try {
    query = getWeekPlanQuerySchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_query', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const plan = await getWeekPlan(query.userId, query.weekIso);
  if (!plan) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(plan);
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
    req = generateWeekPlanRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await generateWeekPlan(req);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'generate_failed', message }, { status: 422 });
  }
}
