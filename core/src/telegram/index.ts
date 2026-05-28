// Barrel домена telegram (scr-telegram-agent): linking chatId ↔ user.
export {
  createLinkToken,
  linkTelegramAccount,
  resolveUserIdByChatId,
  buildStartDeepLink,
} from './service.js';
export { telegramLinkRequestSchema } from './schemas.js';
export type { TelegramLinkRequest } from './schemas.js';
