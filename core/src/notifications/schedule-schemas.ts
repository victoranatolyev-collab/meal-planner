import { z } from 'zod';
import { NotificationTrigger } from '@prisma/client';

/** CRUD-схемы расписания уведомлений (scr-edit-schedule). */

export const scheduleCreateSchema = z.object({
  userId: z.string().uuid(),
  triggerType: z.nativeEnum(NotificationTrigger),
  schedule: z.string().min(1).max(200),
  reminderList: z.string().min(1).max(100).default('Daily'),
  template: z.string().min(1).max(500),
  isActive: z.boolean().default(true),
});
export type ScheduleCreate = z.infer<typeof scheduleCreateSchema>;

export const scheduleUpdateSchema = z
  .object({
    triggerType: z.nativeEnum(NotificationTrigger).optional(),
    schedule: z.string().min(1).max(200).optional(),
    reminderList: z.string().min(1).max(100).optional(),
    template: z.string().min(1).max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'пустой patch — нечего обновлять' });
export type ScheduleUpdate = z.infer<typeof scheduleUpdateSchema>;
