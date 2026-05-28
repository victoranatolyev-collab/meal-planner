import { NextResponse, type NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { pushReminders } from 'core';

/**
 * POST /api/notifications/run  body { userId, date? (YYYY-MM-DD) }
 * scr-notifications (ручной триггер): генерирует задачи из активных расписаний пользователя
 * на дату и пушит (stub/CalDAV). Дедуп по UID. Ответ: 200 { tasks, upserted, uids, ... }.
 */
const bodySchema = z.object({
  userId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const dateIso = parsed.date ?? new Date().toISOString().slice(0, 10);
  const result = await pushReminders(parsed.userId, dateIso);
  return NextResponse.json(result);
}
