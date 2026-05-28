import cron from 'node-cron';
import pino from 'pino';
import { runParseFiveKa } from './jobs/parse-5ka.js';
import { runParseTseh } from './jobs/parse-tseh.js';
import { runParseLl } from './jobs/parse-ll.js';
import { runParseVv } from './jobs/parse-vv.js';
import { runNotifications } from './jobs/notifications.js';

// Worker entry point. См. docs/ARCHITECTURE.md §6.

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: { service: 'worker' },
});

logger.info({ pid: process.pid, node: process.version }, 'worker started');

// Heartbeat — раз в минуту лог (debug-уровень).
const heartbeat = cron.schedule('* * * * *', () => {
  logger.debug('heartbeat');
});

// Парсинг каталогов — все по субботам (за сутки до заказа на следующую неделю).
const parseFiveKa = cron.schedule('0 3 * * 6', () => void runParseFiveKa());
const parseTseh = cron.schedule('15 3 * * 6', () => void runParseTseh());
const parseLl = cron.schedule('30 3 * * 6', () => void runParseLl());
const parseVv = cron.schedule('45 3 * * 6', () => void runParseVv());

// Push Apple Reminders — ежедневно 04:00 (scr-notifications).
const notifications = cron.schedule('0 4 * * *', () => void runNotifications());

logger.info('cron jobs registered: heartbeat, parse-5ka 03:00, parse-tseh 03:15, parse-ll 03:30, parse-vv 03:45 (Sat), notifications 04:00 (daily)');

// Graceful shutdown.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutdown requested');
  heartbeat.stop();
  parseFiveKa.stop();
  parseTseh.stop();
  parseLl.stop();
  parseVv.stop();
  notifications.stop();
  setTimeout(() => {
    logger.info('worker stopped');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
