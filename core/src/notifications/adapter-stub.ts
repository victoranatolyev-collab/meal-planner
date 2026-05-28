import pino from 'pino';
import type { ReminderAdapter, ReminderTask } from './types.js';

const logger = pino({ name: 'reminders:stub' });

/**
 * Stub-адаптер: не пушит в CalDAV, логирует задачи + трекает uid (дедуп).
 * Default без Apple creds. Реальный CalDAVReminderAdapter (caldav npm +
 * APPLE_ID/APPLE_APP_PASSWORD) — backlog (ARCHITECTURE §8.3).
 */
export class StubReminderAdapter implements ReminderAdapter {
  readonly name = 'stub';
  readonly seen = new Set<string>();

  async upsert(tasks: ReminderTask[]): Promise<{ upserted: number }> {
    for (const t of tasks) {
      this.seen.add(t.uid);
      logger.info({ uid: t.uid, title: t.title, list: t.list, dueAt: t.dueAt }, 'reminder (stub)');
    }
    return { upserted: tasks.length };
  }
}
