import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './server.js';
import { startQueue, stopQueue, getBoss } from './jobs/queue.js';
import { handleJob } from './jobs/handler.js';
import { JOB_KINDS, type JobKind } from './jobs/types.js';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: { service: 'llm-service' },
});

async function main(): Promise<void> {
  logger.info({ pid: process.pid, node: process.version, mode: process.env['LLM_MODE'] }, 'starting');

  // 1. Поднимаем pg-boss queue (создаёт schema `pgboss` при первом старте).
  await startQueue();

  // 2. Создаём queue для каждого kind (pg-boss 10 требует явный createQueue до send/work).
  // Регистрируем handler.
  const boss = getBoss();
  for (const kind of JOB_KINDS) {
    await boss.createQueue(kind);
    await boss.work(
      kind,
      async (jobs) => {
        for (const job of jobs) {
          const payload = job.data as { data: unknown; userId?: string };
          await handleJob({
            kind: kind as JobKind,
            data: payload.data,
            pgBossJobId: job.id,
            userId: payload.userId,
          });
        }
      },
    );
    logger.info({ kind }, 'queue + worker registered');
  }

  // 3. Поднимаем HTTP сервер.
  const port = Number(process.env['PORT'] ?? '3001');
  const app = createApp();
  const server = serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ address: info.address, port: info.port }, 'http listening');
  });

  // 4. Graceful shutdown.
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'shutdown requested');
    server.close();
    await stopQueue();
    logger.info('shutdown complete');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal startup error');
  process.exit(1);
});
