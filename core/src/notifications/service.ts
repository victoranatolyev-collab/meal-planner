import pino from 'pino';
import { prisma } from '../db.js';
import { buildReminderTasks } from './build.js';
import { StubReminderAdapter } from './adapter-stub.js';
import type { ReminderAdapter } from './types.js';

const logger = pino({ name: 'reminders:push' });

/** NOTIFICATIONS_MODE=caldav → реальный CalDAV (backlog). Сейчас только stub. */
function defaultAdapter(): ReminderAdapter {
  return new StubReminderAdapter();
}

export interface PushRemindersResult {
  userId: string;
  dateIso: string;
  tasks: number;
  upserted: number;
  uids: string[];
}

/**
 * scr-notifications: генерирует задачи из активных расписаний пользователя на дату
 * и пушит через adapter (дедуп по UID — повторный запуск не дублирует).
 */
export async function pushReminders(
  userId: string,
  dateIso: string,
  adapter: ReminderAdapter = defaultAdapter(),
): Promise<PushRemindersResult> {
  const schedules = await prisma.notificationSchedule.findMany({
    where: { userId, isActive: true },
  });
  const tasks = buildReminderTasks(schedules, dateIso);
  const { upserted } = await adapter.upsert(tasks);
  logger.info({ userId, dateIso, tasks: tasks.length, adapter: adapter.name }, 'reminders pushed');
  return { userId, dateIso, tasks: tasks.length, upserted, uids: tasks.map((t) => t.uid) };
}

/** Для worker cron: всем пользователям с активными расписаниями. */
export async function runDailyReminders(
  dateIso: string,
  adapter: ReminderAdapter = defaultAdapter(),
): Promise<{ users: number; tasks: number }> {
  const rows = await prisma.notificationSchedule.findMany({
    where: { isActive: true },
    distinct: ['userId'],
    select: { userId: true },
  });
  let tasks = 0;
  for (const { userId } of rows) {
    const result = await pushReminders(userId, dateIso, adapter);
    tasks += result.tasks;
  }
  return { users: rows.length, tasks };
}
