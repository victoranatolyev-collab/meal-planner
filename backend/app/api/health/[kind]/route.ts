import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  HEALTH_KINDS,
  healthListQuerySchema,
  anthropometryCreateSchema,
  labTestCreateSchema,
  trainingLogCreateSchema,
  moodLogCreateSchema,
  createAnthropometry,
  listAnthropometry,
  createLabTest,
  listLabTests,
  createTrainingLog,
  listTrainingLogs,
  createMoodLog,
  listMoodLogs,
} from 'core';

/**
 * /api/health/:kind  (kind ∈ anthropometry | lab-tests | training-logs | mood-logs)
 *
 * GET ?userId=<uuid>&limit=N — последние записи (append-only, desc по дате). 200 { items, total }.
 * POST body — создание записи (scr-import-health). 201 record.
 * Ошибки: 404 unknown_kind; 400 invalid_query / invalid_json / invalid_body.
 */
type Kind = (typeof HEALTH_KINDS)[number];

function isKind(k: string): k is Kind {
  return (HEALTH_KINDS as readonly string[]).includes(k);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isKind(kind)) return NextResponse.json({ error: 'unknown_kind' }, { status: 404 });

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  let query;
  try {
    query = healthListQuerySchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_query', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const items = await listByKind(kind, query.userId, query.limit);
  return NextResponse.json({ items, total: items.length });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isKind(kind)) return NextResponse.json({ error: 'unknown_kind' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    const created = await createByKind(kind, body);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }
}

function listByKind(kind: Kind, userId: string, limit: number) {
  switch (kind) {
    case 'anthropometry':
      return listAnthropometry(userId, limit);
    case 'lab-tests':
      return listLabTests(userId, limit);
    case 'training-logs':
      return listTrainingLogs(userId, limit);
    case 'mood-logs':
      return listMoodLogs(userId, limit);
  }
}

function createByKind(kind: Kind, body: unknown) {
  switch (kind) {
    case 'anthropometry':
      return createAnthropometry(anthropometryCreateSchema.parse(body));
    case 'lab-tests':
      return createLabTest(labTestCreateSchema.parse(body));
    case 'training-logs':
      return createTrainingLog(trainingLogCreateSchema.parse(body));
    case 'mood-logs':
      return createMoodLog(moodLogCreateSchema.parse(body));
  }
}
