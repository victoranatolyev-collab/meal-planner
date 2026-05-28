import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { scheduleUpdateSchema, updateSchedule, deleteSchedule } from 'core';

/**
 * PATCH /api/notification-schedules/:id — частичное обновление. 200 | 404.
 * DELETE /api/notification-schedules/:id — 204 | 404.
 * (Next.js 15: params — Promise.)
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  let patch;
  try {
    patch = scheduleUpdateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }
  const updated = await updateSchedule(id, patch);
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const deleted = await deleteSchedule(id);
  if (!deleted) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
