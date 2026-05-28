import { webhookCallback } from 'grammy';
import { getBot } from '@/lib/telegram-bot';

/**
 * POST /api/telegram/webhook — приём Telegram updates (scr-telegram-agent, ARCHITECTURE §9).
 *
 * grammY 'std/http' адаптер: читает update из тела Request, проверяет секрет из заголовка
 * `X-Telegram-Bot-Api-Secret-Token` (если задан TELEGRAM_WEBHOOK_SECRET) → роутит в хендлеры
 * бота (/start linking, message:text → агент). Возвращает 200/401.
 *
 * Реальный приём настраивается через setWebhook с тем же secret (нужен TELEGRAM_BOT_TOKEN).
 * Без токена работает offline-stub (см. lib/telegram-bot.ts) — для смоука симулированными update.
 */
const secretToken = process.env['TELEGRAM_WEBHOOK_SECRET'];

export const POST = webhookCallback(
  getBot(),
  'std/http',
  secretToken ? { secretToken } : {},
);
