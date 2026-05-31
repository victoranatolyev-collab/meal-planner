import PgBoss from 'pg-boss';
import pino from 'pino';

const logger = pino({ name: 'queue' });

let bossInstance: PgBoss | null = null;

/**
 * Создаёт и стартует pg-boss instance.
 * Connection string берётся из DATABASE_URL.
 * pg-boss автоматически создаёт schema `pgboss` при первом старте.
 */
export async function startQueue(): Promise<PgBoss> {
  if (bossInstance) return bossInstance;
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('startQueue: DATABASE_URL env not set');
  }
  const boss = new PgBoss({
    connectionString,
    // Retention: дефолт 7 дней completed jobs, 30 дней archived. Не меняем сейчас.
    // retryLimit=0: ретраи LLM-job'ов вредны — дорого, а при таймауте повтор просто
    // воспроизведёт то же зависание. Ретраи живут per-adapter (см. adapters/*).
    // Это дефолт для всех очередей: они создаются без своего retry_limit, а pg-boss
    // при постановке job делает COALESCE(send, queue, default, 2) → берёт этот 0.
    retryLimit: 0,
  });
  boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));
  await boss.start();
  bossInstance = boss;
  logger.info('pg-boss started');
  return boss;
}

export async function stopQueue(): Promise<void> {
  if (!bossInstance) return;
  await bossInstance.stop();
  bossInstance = null;
  logger.info('pg-boss stopped');
}

export function getBoss(): PgBoss {
  if (!bossInstance) throw new Error('getBoss: queue not started');
  return bossInstance;
}
