import type { ReminderTask, ScheduleInput } from './types.js';

/**
 * Pure (scr-notifications): активные расписания → задачи-напоминания на дату.
 * uid = `${scheduleId}:${dateIso}` — детерминированный → дедуп при повторных запусках
 * (CalDAV дедуплицирует по UID; повторный push не создаёт дубль). title = template.
 * Для TIME-триггера со schedule вида "HH:MM" — dueAt = дата+время, иначе null.
 */
export function buildReminderTasks(schedules: ScheduleInput[], dateIso: string): ReminderTask[] {
  return schedules
    .filter((s) => s.isActive)
    .map((s) => ({
      uid: `${s.id}:${dateIso}`,
      title: s.template,
      list: s.reminderList,
      dueAt: dueAtFor(s, dateIso),
    }));
}

function dueAtFor(s: ScheduleInput, dateIso: string): string | null {
  if (s.triggerType === 'TIME') {
    const m = s.schedule.match(/^(\d{2}):(\d{2})$/);
    if (m) return `${dateIso}T${m[1]}:${m[2]}:00`;
  }
  // MEAL_RELATIVE / EVENT / cron — резолв времени в проде CalDAV-адаптером (refinement).
  return null;
}
