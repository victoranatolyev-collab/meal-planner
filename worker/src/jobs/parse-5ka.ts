import pino from 'pino';
import { importFiveKa } from 'core';

const logger = pino({ name: 'job:parse-5ka' });

/**
 * Cron-задача: парсинг каталога 5К.
 * Расписание: `0 3 * * 6` (Сб 03:00 локально — за сутки до заказа).
 *
 * Реализация в core/src/parsers/five-ka/importer.ts:
 *  - читает FIVEKA_PARSER_MODE (stub|api)
 *  - INSERT в source_5ka (append-only снимок)
 *  - UPSERT в ingredients (idempotent по name+source+pack_size)
 */
export async function runParseFiveKa(): Promise<void> {
  logger.info('start');
  try {
    const result = await importFiveKa();
    logger.info(result, 'done');
  } catch (err) {
    logger.error({ err }, 'failed');
    // Не пробрасываем — cron должен продолжать работать.
  }
}
