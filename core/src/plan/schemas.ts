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
  time: z.string().optional(),
  mealTags: z.array(z.string()).default([]),
  items: z.array(draftItemSchema).min(1).max(10),
});

export const draftDaySchema = z.object({
  date: z.string(),
  dayType: z.string().optional(),
  meals: z.array(draftMealSchema).min(1).max(10),
});

export const calcPlanOutputSchema = z.object({
  days: z.array(draftDaySchema).min(1).max(7),
});

export type DraftItem = z.infer<typeof draftItemSchema>;
export type DraftMeal = z.infer<typeof draftMealSchema>;
export type DraftDay = z.infer<typeof draftDaySchema>;
export type DraftPlan = z.infer<typeof calcPlanOutputSchema>;
