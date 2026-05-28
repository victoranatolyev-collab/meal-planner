import { z } from 'zod';
import type { RuleKind } from '@/api/tag-rules';

export const RULE_KINDS = [
  'BAN_TAG',
  'BAN_TAG_IN_MEAL',
  'REQUIRE_TAG_IN_MEAL',
  'MIN_PER_WEEK',
  'MAX_PER_WEEK',
] as const;

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  BAN_TAG: 'Запрет тега (везде)',
  BAN_TAG_IN_MEAL: 'Запрет тега в приёме',
  REQUIRE_TAG_IN_MEAL: 'Обязателен в приёме',
  MIN_PER_WEEK: 'Минимум раз/неделю',
  MAX_PER_WEEK: 'Максимум раз/неделю',
};

const isWeekly = (k: RuleKind) => k === 'MIN_PER_WEEK' || k === 'MAX_PER_WEEK';
const isInMeal = (k: RuleKind) => k === 'BAN_TAG_IN_MEAL' || k === 'REQUIRE_TAG_IN_MEAL';

// Зеркало backend tagRuleCreateSchema (core/src/rules/schemas.ts).
// quantity — NaN=пусто (React Aria NumberField).
export const tagRuleFormSchema = z
  .object({
    ruleKind: z.enum(RULE_KINDS),
    tagName: z.string().min(1, 'Укажите тег').max(100),
    mealTag: z.string().max(100).optional(),
    quantity: z.union([z.number().int().min(1).max(21), z.nan()]),
    exceptionTag: z.string().max(100).optional(),
    reason: z.string().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (isWeekly(val.ruleKind) && (val.quantity === undefined || Number.isNaN(val.quantity))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Укажите количество',
      });
    }
    if (isInMeal(val.ruleKind) && !val.mealTag) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mealTag'], message: 'Укажите meal-тег' });
    }
  });

export type TagRuleFormValues = z.infer<typeof tagRuleFormSchema>;
