import { z } from 'zod';

/**
 * Виды LLM-job. Каждый kind имеет свою input + output Zod-схему.
 */
export const JOB_KINDS = ['search-recipes', 'calc-plan', 'agent-reply'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/**
 * Запрос на job из backend/worker.
 */
export const jobRequestSchema = z.object({
  kind: z.enum(JOB_KINDS),
  input: z.unknown(), // конкретный schema валидируется в handler по kind
  userId: z.string().uuid().optional(),
});
export type JobRequest = z.infer<typeof jobRequestSchema>;

// ============================================================
// search-recipes
// ============================================================

export const searchRecipesInputSchema = z.object({
  count: z.number().int().min(1).max(20).default(5),
  mealTags: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
});
export type SearchRecipesInput = z.infer<typeof searchRecipesInputSchema>;

const recipeSchema = z.object({
  name: z.string().min(1).max(200),
  instructions: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      qty: z.number().positive(),
      unit: z.string().min(1),
      note: z.string().optional(),
    }),
  ).min(1).max(30),
  mealTags: z.array(z.string()).default([]),
});

export const searchRecipesOutputSchema = z.object({
  recipes: z.array(recipeSchema).min(1).max(20),
});
export type SearchRecipesOutput = z.infer<typeof searchRecipesOutputSchema>;

// ============================================================
// calc-plan (Phase 3 — scr-calc-week-plan, hybrid LLM draft)
// LLM получает targets + пул одобренных рецептов и собирает черновик недели.
// Output зеркалит дерево ent-week-plan (days → meals → items).
// ============================================================

/** Кандидат-рецепт в пуле (LLM выбирает по id). */
export const calcPlanRecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  mealTags: z.array(z.string()).default([]),
});

export const calcPlanInputSchema = z.object({
  weekIso: z.string().regex(/^\d{4}-W\d{2}$/),
  startDate: z.string(), // ISO date
  endDate: z.string(),
  targets: z.object({
    kcalPerDay: z.number().positive(),
    proteinGPerDay: z.number().positive(),
    fatGPerDay: z.number().positive(),
    carbsGPerDay: z.number().positive(),
  }),
  days: z
    .array(z.object({ date: z.string(), dayType: z.string().optional() }))
    .min(1)
    .max(7),
  recipes: z.array(calcPlanRecipeSchema).min(1),
  notes: z.string().max(2000).optional(),
});
export type CalcPlanInput = z.infer<typeof calcPlanInputSchema>;

const calcPlanItemSchema = z.object({
  recipeId: z.string(),
  portionFactor: z.number().positive().max(10).default(1),
  fromStock: z.boolean().default(false),
  tail: z.boolean().default(false),
});
const calcPlanMealSchema = z.object({
  name: z.string().min(1),
  time: z.string().nullish(), // LLM может вернуть null вместо отсутствия
  mealTags: z.array(z.string()).default([]),
  items: z.array(calcPlanItemSchema).min(1).max(10),
});
const calcPlanDaySchema = z.object({
  date: z.string(),
  dayType: z.string().nullish(), // LLM может вернуть null для дня без типа
  meals: z.array(calcPlanMealSchema).min(1).max(10),
});

export const calcPlanOutputSchema = z.object({
  days: z.array(calcPlanDaySchema).min(1).max(7),
});
export type CalcPlanOutput = z.infer<typeof calcPlanOutputSchema>;

// ============================================================
// agent-reply (Phase 6 — scr-telegram-agent, Claude tool-use)
// ============================================================

/** Сообщение истории диалога (короткая память агента). */
const agentHistoryMessageSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT']),
  content: z.string(),
});

/** Доступный агенту инструмент (= scr-* core-сервис). */
const agentToolSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const agentReplyInputSchema = z.object({
  userId: z.string().uuid(),
  message: z.string().min(1),
  history: z.array(agentHistoryMessageSchema).default([]),
  tools: z.array(agentToolSchema).default([]),
});

export const agentReplyOutputSchema = z.object({
  reply: z.string(),
  intent: z.string().optional(),
  toolCalls: z
    .array(z.object({ tool: z.string(), input: z.record(z.unknown()).default({}) }))
    .default([]),
});

// ============================================================
// Map kind → schemas (для handler)
// ============================================================

export const KIND_SCHEMAS = {
  'search-recipes': { input: searchRecipesInputSchema, output: searchRecipesOutputSchema },
  'calc-plan': { input: calcPlanInputSchema, output: calcPlanOutputSchema },
  'agent-reply': { input: agentReplyInputSchema, output: agentReplyOutputSchema },
} as const;
