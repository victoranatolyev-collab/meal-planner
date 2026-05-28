import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { prisma } from '../db.js';

const logger = pino({ name: 'telegram-link' });

/**
 * Linking flow (scr-telegram-agent, ARCHITECTURE §8.2/§9.3):
 *  1. Веб-приложение запрашивает токен → createLinkToken(userId) → deep-link `t.me/<bot>?start=<token>`.
 *  2. Пользователь жмёт ссылку, бот получает `/start <token>` → linkTelegramAccount привязывает chatId.
 *  3. Дальше каждое сообщение авторизуется по chatId → resolveUserIdByChatId.
 *
 * telegram_accounts: 1:1 с user. chatId/linkToken nullable+unique (несколько NULL в Postgres OK).
 */

/** Создаёт/обновляет одноразовый токен привязки для пользователя. Аккаунт неактивен до /start. */
export async function createLinkToken(userId: string): Promise<{ linkToken: string }> {
  const linkToken = randomUUID();
  await prisma.telegramAccount.upsert({
    where: { userId },
    create: { userId, linkToken, isActive: false },
    update: { linkToken },
  });
  logger.info({ userId }, 'link token issued');
  return { linkToken };
}

/** Привязывает chatId к аккаунту по токену. Токен одноразовый — гасится. Возвращает userId или null. */
export async function linkTelegramAccount(args: {
  token: string;
  chatId: string;
  username?: string | undefined;
  firstName?: string | undefined;
}): Promise<{ userId: string } | null> {
  const account = await prisma.telegramAccount.findUnique({ where: { linkToken: args.token } });
  if (!account) return null;
  const updated = await prisma.telegramAccount.update({
    where: { id: account.id },
    data: {
      chatId: args.chatId,
      username: args.username ?? null,
      firstName: args.firstName ?? null,
      linkToken: null,
      isActive: true,
      linkedAt: new Date(),
    },
  });
  logger.info({ userId: updated.userId, chatId: args.chatId }, 'telegram account linked');
  return { userId: updated.userId };
}

/** Авторизация входящего сообщения: chatId → userId (только активные привязки). */
export async function resolveUserIdByChatId(chatId: string): Promise<string | null> {
  const account = await prisma.telegramAccount.findUnique({ where: { chatId } });
  if (!account || !account.isActive) return null;
  return account.userId;
}

/** Pure: deep-link для /start-привязки. */
export function buildStartDeepLink(botUsername: string, token: string): string {
  return `https://t.me/${botUsername}?start=${token}`;
}
