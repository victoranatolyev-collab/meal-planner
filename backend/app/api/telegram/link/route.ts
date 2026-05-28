import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { telegramLinkRequestSchema, createLinkToken, buildStartDeepLink } from 'core';

/**
 * POST /api/telegram/link  body { userId }
 *
 * scr-telegram-agent linking (ARCHITECTURE §8.2): выдаёт одноразовый токен + deep-link
 * `t.me/<bot>?start=<token>`. Пользователь жмёт ссылку → бот получает /start <token> →
 * привязывает chatId к userId.
 *
 * Ответ: 201 { linkToken, deepLink }. Ошибки: 400 invalid_json/invalid_body.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let input;
  try {
    input = telegramLinkRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const { linkToken } = await createLinkToken(input.userId);
  const botUsername = process.env['TELEGRAM_BOT_USERNAME'] ?? 'mealplanner_bot';
  return NextResponse.json(
    { linkToken, deepLink: buildStartDeepLink(botUsername, linkToken) },
    { status: 201 },
  );
}
