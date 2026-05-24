import cron from 'node-cron';
import pino from 'pino';
import { runParseFiveKa } from './jobs/parse-5ka.js';

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

// Парсинг 5К — Сб 03:00 локально (за сутки до заказа на следующую неделю).
const parseFiveKa = cron.schedule('0 3 * * 6', () => {
  void runParseFiveKa();
});

logger.info('cron jobs registered: heartbeat, parse-5ka (Sat 03:00)');

// Graceful shutdown.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutdown requested');
  heartbeat.stop();
  parseFiveKa.stop();
  setTimeout(() => {
    logger.info('worker stopped');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
