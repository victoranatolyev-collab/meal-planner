import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { userIdQuerySchema, calcNormsForUser } from 'core';

/**
 * GET /api/norms?userId=<uuid>
 *
 * scr-calc-norms: рекомендация целевых КБЖУ из последнего снимка anthropometry
 * (BMR Mifflin-St Jeor × активность × цель + макросы). НЕ перезаписывает NutritionTarget.
 *
 * Ответ: 200 { bmr, tdee, kcalPerDay, proteinGPerDay, fatGPerDay, carbsGPerDay, breakdown, source }
 * Ошибки: 400 invalid_query; 422 calc_failed (нет anthropometry / не заданы activityLevel/goal).
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

  try {
    const norms = await calcNormsForUser(query.userId);
    return NextResponse.json(norms);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'calc_failed', message }, { status: 422 });
  }
}
