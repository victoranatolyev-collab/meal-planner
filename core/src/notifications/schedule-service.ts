import { prisma } from '../db.js';
import type { ScheduleCreate, ScheduleUpdate } from './schedule-schemas.js';

/**
 * CRUD расписания уведомлений (scr-edit-schedule). Поверх ent-notification-schedule.
 * update/delete → null/false если не найдено (route отдаёт 404).
 */

export async function listSchedules(userId: string) {
  return prisma.notificationSchedule.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createSchedule(input: ScheduleCreate) {
  return prisma.notificationSchedule.create({ data: input });
}

export async function updateSchedule(id: string, patch: ScheduleUpdate) {
  const existing = await prisma.notificationSchedule.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.notificationSchedule.update({ where: { id }, data: patch });
}

export async function deleteSchedule(id: string): Promise<boolean> {
  const existing = await prisma.notificationSchedule.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.notificationSchedule.delete({ where: { id } });
  return true;
}
