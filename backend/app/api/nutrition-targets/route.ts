import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  userIdQuerySchema,
  nutritionTargetUpsertSchema,
  getNutritionTarget,
  upsertNutritionTarget,
} from 'core';

/**
 * GET /api/nutrition-targets?userId=<uuid>
 * Целевые КБЖУ + бюджет пользователя (1:1). 404 если ещё не заданы.
 *
 * PUT /api/nutrition-targets
 * Body: { userId, kcalPerDay, proteinGPerDay, fatGPerDay, carbsGPerDay, proteinGPerKgMin?, budget*? }
 * Upsert (создаёт или обновляет). Ответ: 200 NutritionTarget.
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

  const target = await getNutritionTarget(query.userId);
  if (!target) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(target);
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let input;
  try {
    input = nutritionTargetUpsertSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const target = await upsertNutritionTarget(input);
  return NextResponse.json(target);
}
