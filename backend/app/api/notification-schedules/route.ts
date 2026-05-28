import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { userIdQuerySchema, scheduleCreateSchema, listSchedules, createSchedule } from 'core';

/**
 * GET /api/notification-schedules?userId=<uuid> — расписания пользователя { items, total }.
 * POST /api/notification-schedules — создать (scr-edit-schedule). 201 schedule.
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
  const rules = await listSchedules(query.userId);
  return NextResponse.json({ items: rules, total: rules.length });
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
    input = scheduleCreateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }
  const schedule = await createSchedule(input);
  return NextResponse.json(schedule, { status: 201 });
}
