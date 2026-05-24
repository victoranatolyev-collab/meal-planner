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
// calc-plan (Phase 3 — placeholder)
// ============================================================

export const calcPlanInputSchema = z.object({
  weekIso: z.string().regex(/^\d{4}-W\d{2}$/),
});
export const calcPlanOutputSchema = z.object({
  plan: z.unknown(), // TODO Phase 3
});

// ============================================================
// agent-reply (Phase 6 — placeholder)
// ============================================================

export const agentReplyInputSchema = z.object({
  chatId: z.string(),
  message: z.string(),
});
export const agentReplyOutputSchema = z.object({
  reply: z.string(),
  toolCalls: z.array(z.unknown()).default([]),
});

// ============================================================
// Map kind → schemas (для handler)
// ============================================================

export const KIND_SCHEMAS = {
  'search-recipes': { input: searchRecipesInputSchema, output: searchRecipesOutputSchema },
  'calc-plan': { input: calcPlanInputSchema, output: calcPlanOutputSchema },
  'agent-reply': { input: agentReplyInputSchema, output: agentReplyOutputSchema },
} as const;
