import { Bot } from 'grammy';
import { registerAgentHandlers, botClientConfig } from '../lib/telegram-bot';

/**
 * Локальный запуск Telegram-бота в режиме long-polling (не webhook).
 * Для dev/демо: не нужен публичный HTTPS-URL, как для webhook.
 * Прод использует webhook (`/api/telegram/webhook`).
 *
 * Запуск:
 *   TELEGRAM_BOT_TOKEN=... DATABASE_URL=... LLM_SERVICE_URL=http://localhost:3001 \
 *     npx tsx backend/scripts/telegram-polling.ts
 */
const token = process.env['TELEGRAM_BOT_TOKEN'];
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN не задан — нечего запускать.');
  process.exit(1);
}

const bot = new Bot(token, botClientConfig());
registerAgentHandlers(bot);
bot.catch((err) => console.error('[telegram] bot error:', err.message));

// Логи в stderr — синхронный вывод (без block-буферизации при редиректе в файл).
console.error('[telegram] starting…');
bot
  .start({
    drop_pending_updates: true,
    onStart: (info) => console.error(`[telegram] polling as @${info.username} (id ${info.id})`),
  })
  .catch((err) => {
    console.error('[telegram] start failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
