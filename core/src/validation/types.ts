import type { RuleKind } from '@prisma/client';

/**
 * Тэги рецепта + ингредиентов в форме, удобной для pure-функции валидации.
 * НЕ зависит от Prisma model'ей — это контракт ядра.
 */
export interface IngredientView {
  id: string;
  name: string;
  tags: string[];
}

/**
 * Snapshot одного правила пользователя (читаем из tag_rules).
 * Pure-функция работает с этим типом, не с Prisma TagRule напрямую — это даёт
 * полную свободу тестам (можно сконструировать вручную).
 */
export interface RuleSnapshot {
  id: string;
  ruleKind: RuleKind;
  tagName: string;
  mealTag: string | null;
  quantity: number | null;
  exceptionTag: string | null;
  reason: string | null;
}

/**
 * Вход валидатора-pure: рецепт (как набор ингредиентов и его meal-тегов)
 * + активные правила пользователя.
 */
export interface ValidationInput {
  recipeName: string;
  ingredients: IngredientView[];
  recipeMealTags: string[];
  rules: RuleSnapshot[];
}

/**
 * Результат валидации одного рецепта.
 */
export interface ValidationResult {
  isApproved: boolean;
  rejectionReasons: string[];
}
