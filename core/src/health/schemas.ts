import { z } from 'zod';
import { ActivityLevel, Goal, Sex } from '@prisma/client';

/**
 * Zod-схемы импорта health-данных (scr-import-health). 4 вида записей, все append-only.
 * Даты опциональны (z.coerce.date) — default now() в service. OCR/PDF — backlog.
 */

export const HEALTH_KINDS = ['anthropometry', 'lab-tests', 'training-logs', 'mood-logs'] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];

export const anthropometryCreateSchema = z.object({
  userId: z.string().uuid(),
  measuredAt: z.coerce.date().optional(),
  sex: z.nativeEnum(Sex),
  ageYears: z.number().int().min(0).max(120),
  heightCm: z.number().positive().max(300),
  weightKg: z.number().positive().max(500),
  bodyFatPercent: z.number().min(0).max(70).optional(),
  leanMassKg: z.number().positive().max(500).optional(),
  bmi: z.number().positive().max(100).optional(),
  ffmi: z.number().positive().max(100).optional(),
  waistCm: z.number().positive().max(300).optional(),
  activityLevel: z.nativeEnum(ActivityLevel).optional(),
  stepsPerDay: z.number().int().nonnegative().max(100000).optional(),
  strengthMinutesPerWeek: z.number().int().nonnegative().max(10080).optional(),
  cardioMinutesPerWeek: z.number().int().nonnegative().max(10080).optional(),
  goal: z.nativeEnum(Goal).optional(),
  note: z.string().max(1000).optional(),
});
export type AnthropometryCreate = z.infer<typeof anthropometryCreateSchema>;

export const labTestCreateSchema = z.object({
  userId: z.string().uuid(),
  measuredAt: z.coerce.date().optional(),
  analyte: z.string().min(1).max(100),
  value: z.number(),
  unit: z.string().min(1).max(30),
  referenceLow: z.number().optional(),
  referenceHigh: z.number().optional(),
  status: z.string().max(50).optional(),
  isFlagged: z.boolean().default(false),
  note: z.string().max(1000).optional(),
});
export type LabTestCreate = z.infer<typeof labTestCreateSchema>;

export const trainingLogCreateSchema = z.object({
  userId: z.string().uuid(),
  performedAt: z.coerce.date().optional(),
  kind: z.string().min(1).max(50),
  durationMin: z.number().int().positive().max(1440),
  intensity: z.string().max(50).optional(),
  note: z.string().max(1000).optional(),
});
export type TrainingLogCreate = z.infer<typeof trainingLogCreateSchema>;

export const moodLogCreateSchema = z.object({
  userId: z.string().uuid(),
  loggedAt: z.coerce.date().optional(),
  mood: z.number().int().min(1).max(10).optional(),
  energy: z.number().int().min(1).max(10).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  symptoms: z.array(z.string().min(1)).max(50).default([]),
  note: z.string().max(1000).optional(),
});
export type MoodLogCreate = z.infer<typeof moodLogCreateSchema>;

export const healthListQuerySchema = z.object({
  userId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type HealthListQuery = z.infer<typeof healthListQuerySchema>;
