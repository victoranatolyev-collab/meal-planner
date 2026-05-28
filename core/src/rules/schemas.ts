import { z } from 'zod';
import { RuleKind } from '@prisma/client';

/**
 * Zod-схемы домена rules (scr-edit-rules) — CRUD управление ДАННЫМИ правил питания.
 *
 * NB: это про управление правилами (`tag_rules` + `nutrition_targets`).
 * Движок ПРОВЕРКИ рецептов против правил — отдельно, в `core/src/validation/`.
 *
 * Единый источник для REST endpoints + Telegram-агент tool (ARCHITECTURE §4.2, §9.2).
 */

/** Query `?userId=...` для list/get эндпоинтов. */
export const userIdQuerySchema = z.object({
  userId: z.string().uuid(),
});
export type UserIdQuery = z.infer<typeof userIdQuerySchema>;

// ============================================================
// nutrition_targets (1:1 с user) — upsert
// ============================================================

export const nutritionTargetUpsertSchema = z.object({
  userId: z.string().uuid(),
  kcalPerDay: z.number().positive().max(20000),
  proteinGPerDay: z.number().positive().max(2000),
  fatGPerDay: z.number().positive().max(2000),
  carbsGPerDay: z.number().positive().max(2000),
  proteinGPerKgMin: z.number().positive().max(10).optional(),
  budgetTargetRubPerWeek: z.number().nonnegative().max(1000000).optional(),
  budgetSoftCapRubPerWeek: z.number().nonnegative().max(1000000).optional(),
});
export type NutritionTargetUpsert = z.infer<typeof nutritionTargetUpsertSchema>;

// ============================================================
// tag_rules (many per user) — create / update
// ============================================================

const TAG = z.string().min(1).max(100);
const QTY = z.number().int().min(1).max(21); // максимум 3 приёма × 7 дней
const REASON = z.string().max(500);

/** true для правил, где quantity обязателен. */
function isWeekly(kind: RuleKind): boolean {
  return kind === RuleKind.MIN_PER_WEEK || kind === RuleKind.MAX_PER_WEEK;
}
/** true для правил, где mealTag обязателен. */
function isInMeal(kind: RuleKind): boolean {
  return kind === RuleKind.BAN_TAG_IN_MEAL || kind === RuleKind.REQUIRE_TAG_IN_MEAL;
}

export const tagRuleCreateSchema = z
  .object({
    userId: z.string().uuid(),
    ruleKind: z.nativeEnum(RuleKind),
    tagName: TAG,
    mealTag: TAG.optional(),
    quantity: QTY.optional(),
    exceptionTag: TAG.optional(),
    reason: REASON.optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    if (isWeekly(val.ruleKind) && val.quantity === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'quantity обязателен для MIN_PER_WEEK / MAX_PER_WEEK',
      });
    }
    if (isInMeal(val.ruleKind) && !val.mealTag) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mealTag'],
        message: 'mealTag обязателен для BAN_TAG_IN_MEAL / REQUIRE_TAG_IN_MEAL',
      });
    }
  });
export type TagRuleCreate = z.infer<typeof tagRuleCreateSchema>;

/**
 * Patch правила. Все поля опциональны; nullable там, где колонка nullable
 * (явный null = очистить поле). userId менять нельзя. Пустой patch отвергается.
 */
export const tagRuleUpdateSchema = z
  .object({
    ruleKind: z.nativeEnum(RuleKind).optional(),
    tagName: TAG.optional(),
    mealTag: TAG.nullable().optional(),
    quantity: QTY.nullable().optional(),
    exceptionTag: TAG.nullable().optional(),
    reason: REASON.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'пустой patch — нечего обновлять' });
export type TagRuleUpdate = z.infer<typeof tagRuleUpdateSchema>;
