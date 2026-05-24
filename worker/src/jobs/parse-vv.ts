import pino from 'pino';
import { importVv } from 'core';

const logger = pino({ name: 'job:parse-vv' });

/**
 * Cron-задача: парсинг каталога ВкусВилл (stub).
 * Расписание см. worker/src/index.ts.
 */
export async function runParseVv(): Promise<void> {
  logger.info('start');
  try {
    const result = await importVv();
    logger.info(result, 'done');
  } catch (err) {
    logger.error({ err }, 'failed');
  }
}
