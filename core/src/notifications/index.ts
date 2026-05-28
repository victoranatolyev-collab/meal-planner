// Barrel домена notifications (scr-notifications): расписания → Apple Reminders (CalDAV).
export { pushReminders, runDailyReminders } from './service.js';
export type { PushRemindersResult } from './service.js';
export { buildReminderTasks } from './build.js';
export { StubReminderAdapter } from './adapter-stub.js';
export type { ScheduleInput, ReminderTask, ReminderAdapter } from './types.js';
