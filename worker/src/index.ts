import cron from 'node-cron';
import pino from 'pino';

// Worker entry point.
// На текущей фазе — только heartbeat. Реальные cron-задачи (парсеры, push Apple Reminders,
// пересчёт остатков) будут добавляться в Phase 1, 5, и т.д. согласно docs/ARCHITECTURE.md §6.

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: { service: 'worker' },
});

logger.info({ pid: process.pid, node: process.version }, 'worker started');

// Heartbeat: раз в минуту лог. Помогает понять, что контейнер живой.
const heartbeat = cron.schedule('* * * * *', () => {
  logger.debug('heartbeat');
});

// Graceful shutdown.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutdown requested');
  heartbeat.stop();
  // Дать время дожить незавершённым задачам, потом выйти.
  setTimeout(() => {
    logger.info('worker stopped');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
