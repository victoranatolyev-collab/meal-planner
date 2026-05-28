import type { NotificationTrigger } from '@prisma/client';

/** Подмножество NotificationSchedule, нужное для генерации задач. */
export interface ScheduleInput {
  id: string;
  triggerType: NotificationTrigger;
  schedule: string;
  reminderList: string;
  template: string;
  isActive: boolean;
}

/** Задача-напоминание для Apple Reminders. */
export interface ReminderTask {
  uid: string; // детерминированный (дедуп по CalDAV UID)
  title: string;
  list: string;
  dueAt: string | null; // ISO datetime
}

/** Контракт адаптера доставки напоминаний (Stub / CalDAV / …). */
export interface ReminderAdapter {
  readonly name: string;
  /** Идемпотентный upsert по uid (повторный вызов не дублирует). */
  upsert(tasks: ReminderTask[]): Promise<{ upserted: number }>;
}
