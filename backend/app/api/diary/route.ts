import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { diaryEntryCreateSchema, userIdQuerySchema, writeDiaryEntry, listDiary } from 'core';

/**
 * GET /api/diary?userId=<uuid> — последние записи дневника { items, total }.
 *
 * POST /api/diary  body { userId, recipeId? | customName, portionFactor?, kcal?..., mealName?, note?, eatenAt? }
 * scr-write-diary: запись факт-приёма (макросы из рецепта если не заданы). Ответ: 201 entry.
 * Ошибки: 400 invalid_*; 422 write_failed (рецепт не найден).
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
  const items = await listDiary(query.userId);
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
    input = diaryEntryCreateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  try {
    const entry = await writeDiaryEntry(input);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'write_failed', message }, { status: 422 });
  }
}
