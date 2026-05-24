import pino from 'pino';
import { importLl } from 'core';

const logger = pino({ name: 'job:parse-ll' });

/**
 * Cron-задача: парсинг каталога Люди Любят (stub).
 * Расписание см. worker/src/index.ts.
 */
export async function runParseLl(): Promise<void> {
  logger.info('start');
  try {
    const result = await importLl();
    logger.info(result, 'done');
  } catch (err) {
    logger.error({ err }, 'failed');
  }
}
