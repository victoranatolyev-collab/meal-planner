import { z } from 'zod';

/**
 * Контракт core на ответ llm-service job `calc-plan` (зеркало llm-service/src/jobs/types.ts).
 * Дублирование намеренно — независимая валидация на границе HTTP (core не импортит llm-service).
 * Структура зеркалит дерево ent-week-plan.
 */

export const draftItemSchema = z.object({
  recipeId: z.string(),
  portionFactor: z.number().positive().max(10).default(1),
  fromStock: z.boolean().default(false),
  tail: z.boolean().default(false),
});

export const draftMealSchema = z.object({
  name: z.string().min(1),
  time: z.string().nullish(), // LLM может вернуть null вместо отсутствия
  mealTags: z.array(z.string()).default([]),
  items: z.array(draftItemSchema).min(1).max(10),
});

export const draftDaySchema = z.object({
  date: z.string(),
  dayType: z.string().nullish(), // LLM может вернуть null для дня без типа
  meals: z.array(draftMealSchema).min(1).max(10),
});

export const calcPlanOutputSchema = z.object({
  days: z.array(draftDaySchema).min(1).max(7),
});

export type DraftItem = z.infer<typeof draftItemSchema>;
export type DraftMeal = z.infer<typeof draftMealSchema>;
export type DraftDay = z.infer<typeof draftDaySchema>;
export type DraftPlan = z.infer<typeof calcPlanOutputSchema>;

/** Запрос на генерацию плана недели (REST `POST /api/plans` / агент). */
export const generateWeekPlanRequestSchema = z.object({
  userId: z.string().uuid(),
  weekIso: z.string().regex(/^\d{4}-W\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayCount: z.number().int().min(1).max(7).optional(),
  dayTypes: z.array(z.string().min(1)).max(7).optional(),
});
export type GenerateWeekPlanRequest = z.infer<typeof generateWeekPlanRequestSchema>;

/** Query для просмотра плана (`GET /api/plans?userId&weekIso`). */
export const getWeekPlanQuerySchema = z.object({
  userId: z.string().uuid(),
  weekIso: z.string().regex(/^\d{4}-W\d{2}$/),
});
export type GetWeekPlanQuery = z.infer<typeof getWeekPlanQuerySchema>;
