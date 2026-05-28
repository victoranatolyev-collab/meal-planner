import pino from 'pino';
import { runDailyReminders } from 'core';

const logger = pino({ name: 'job:notifications' });

/**
 * Ежедневная генерация напоминаний (scr-notifications) → Apple Reminders (CalDAV).
 * Cron 04:00. Stub-режим по умолчанию (реальный CalDAV — backlog).
 */
export async function runNotifications(): Promise<void> {
  const dateIso = new Date().toISOString().slice(0, 10);
  try {
    const result = await runDailyReminders(dateIso);
    logger.info({ ...result, dateIso }, 'daily reminders done');
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'daily reminders failed',
    );
  }
}
