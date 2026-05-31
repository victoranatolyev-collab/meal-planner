import { Bot, type BotConfig, type Context } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { handleAgentMessage, linkTelegramAccount, resolveUserIdByChatId } from 'core';

/**
 * grammY (node-fetch) клиент-конфиг с прокси, если задан HTTPS_PROXY/HTTP_PROXY.
 * Нужно в регионах, где api.telegram.org заблокирован напрямую (доступ через локальный прокси,
 * напр. Clash на :7897). node-fetch принимает прокси через опцию `agent`.
 */
export function botClientConfig(): BotConfig<Context> | undefined {
  const proxy = process.env['HTTPS_PROXY'] ?? process.env['HTTP_PROXY'];
  if (!proxy) return undefined;
  const agent = new HttpsProxyAgent(proxy);
  return { client: { baseFetchConfig: { agent } as never } };
}

/**
 * grammY-бот (scr-telegram-agent, ARCHITECTURE §9). Транспорт поверх transport-agnostic
 * `handleAgentMessage` (мозг) + telegram linking-сервиса.
 *
 * Offline/stub-режим (нет `TELEGRAM_BOT_TOKEN`):
 *  - botInfo задаётся вручную → бот не дёргает getMe при handleUpdate;
 *  - API-transformer короткозамыкает исходящие вызовы → ctx.reply не ходит в сеть.
 * Это позволяет смоук-тестить webhook симулированными update без реального бота.
 * С реальным токеном — обычная работа (reply уходит в Telegram).
 */
const STUB_BOT_INFO = {
  id: 0,
  is_bot: true as const,
  first_name: 'MealPlanner',
  username: 'mealplanner_stub_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  can_manage_bots: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
};

let botSingleton: Bot | null = null;

/** true, если задан реальный TELEGRAM_BOT_TOKEN (исходящие сообщения уходят в Telegram). */
export function isRealBot(): boolean {
  return Boolean(process.env['TELEGRAM_BOT_TOKEN']);
}

/**
 * Регистрирует хендлеры агента на боте. Общий код для webhook (getBot) и polling-раннера
 * (scripts/telegram-polling.ts) — оба используют одну логику.
 *  - `/start <token>` — привязка чата к пользователю (одноразовый токен).
 *  - `message:text` — авторизация по chatId → handleAgentMessage → ответ.
 */
export function registerAgentHandlers(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const chatId = ctx.chatId;
    if (chatId === undefined) return;
    const token = (ctx.match ?? '').trim();
    if (!token) {
      await ctx.reply('Привет! Открой ссылку привязки из веб-приложения, чтобы связать аккаунт.');
      return;
    }
    const linked = await linkTelegramAccount({
      token,
      chatId: String(chatId),
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
    });
    await ctx.reply(
      linked
        ? '✅ Аккаунт привязан. Спрашивай про план недели, остатки, нормы, дневник.'
        : '❌ Токен недействителен или уже использован. Сгенерируй новый в веб-приложении.',
    );
  });

  bot.on('message:text', async (ctx) => {
    const chatId = ctx.chatId;
    if (chatId === undefined) return;
    const userId = await resolveUserIdByChatId(String(chatId));
    if (!userId) {
      await ctx.reply('Аккаунт не привязан. Используй /start <token> из веб-приложения.');
      return;
    }
    const result = await handleAgentMessage({ userId, message: ctx.message.text });
    await ctx.reply(result.reply);
  });
}

/** Ленивая инициализация бота-синглтона (webhook-режим) с зарегистрированными хендлерами. */
export function getBot(): Bot {
  if (botSingleton) return botSingleton;

  const realToken = process.env['TELEGRAM_BOT_TOKEN'];
  const bot = new Bot(realToken ?? '0:OFFLINE_STUB_TOKEN', {
    botInfo: STUB_BOT_INFO,
    ...botClientConfig(),
  });

  if (!realToken) {
    // Stub: проглатываем исходящие API-вызовы (результат не используется).
    bot.api.config.use(async () => ({ ok: true, result: undefined as never }));
  }

  registerAgentHandlers(bot);
  botSingleton = bot;
  return bot;
}
