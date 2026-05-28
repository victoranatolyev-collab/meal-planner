import { z } from 'zod';

/** Запрос на генерацию одноразового токена привязки Telegram (REST `POST /api/telegram/link`). */
export const telegramLinkRequestSchema = z.object({
  userId: z.string().uuid(),
});
export type TelegramLinkRequest = z.infer<typeof telegramLinkRequestSchema>;
