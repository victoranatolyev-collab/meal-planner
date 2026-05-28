import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { getWeekPlanQuerySchema, correctPlan } from 'core';

/**
 * GET /api/correction?userId=<uuid>&weekIso=YYYY-Www
 * scr-correct-plan: сверка факт (дневник) vs план за неделю — остаток КБЖУ по дням.
 * Ответ: 200 { weekIso, dailyTarget, days: [{ date, target, actual, remaining }] }.
 * Ошибки: 400 invalid_query; 422 correct_failed (нет плана).
 */
export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  let query;
  try {
    query = getWeekPlanQuerySchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_query', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  try {
    const result = await correctPlan(query.userId, query.weekIso);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'correct_failed', message }, { status: 422 });
  }
}
