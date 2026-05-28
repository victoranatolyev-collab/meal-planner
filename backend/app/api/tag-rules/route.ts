import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { userIdQuerySchema, tagRuleCreateSchema, listTagRules, createTagRule } from 'core';

/**
 * GET /api/tag-rules?userId=<uuid>
 * Список правил питания пользователя (tag_rules). Ответ: 200 TagRule[].
 *
 * POST /api/tag-rules
 * Body: { userId, ruleKind, tagName, mealTag?, quantity?, exceptionTag?, reason?, isActive? }
 * Создаёт правило. Ответ: 201 TagRule.
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

  const rules = await listTagRules(query.userId);
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
    input = tagRuleCreateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const rule = await createTagRule(input);
  return NextResponse.json(rule, { status: 201 });
}
