import pino from 'pino';
import { importTseh } from 'core';

const logger = pino({ name: 'job:parse-tseh' });

/**
 * Cron-задача: парсинг каталога Цех 85 (stub).
 * Расписание см. worker/src/index.ts.
 */
export async function runParseTseh(): Promise<void> {
  logger.info('start');
  try {
    const result = await importTseh();
    logger.info(result, 'done');
  } catch (err) {
    logger.error({ err }, 'failed');
  }
}
