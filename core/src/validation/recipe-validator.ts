import pino from 'pino';
import { prisma } from '../db.js';
import { evaluateRules } from './evaluate-rules.js';
import type { ValidationResult, RuleSnapshot, IngredientView } from './types.js';

const logger = pino({ name: 'validator:recipe' });

/**
 * Validate a recipe против активных tag_rules пользователя.
 *
 * Контракт: см. docs/ARCHITECTURE.md §7.3.
 *
 * Steps:
 *  1. Fetch recipe + ingredients + recipe_tags
 *  2. Fetch user's active TagRule rows
 *  3. evaluateRules (pure)
 *  4. Persist result: is_approved, rejection_reasons, is_normalized=true
 */
export async function validateRecipe(recipeId: string): Promise<ValidationResult> {
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    include: {
      ingredients: { include: { ingredient: true } },
      tags: true,
    },
  });

  const rules = await prisma.tagRule.findMany({
    where: { userId: recipe.userId, isActive: true },
  });

  const ingredientViews: IngredientView[] = recipe.ingredients.map((ri) => ({
    id: ri.ingredient.id,
    name: ri.ingredient.name,
    tags: ri.ingredient.tags,
  }));

  const recipeMealTags = recipe.tags.map((t) => t.tagName);

  const ruleSnapshots: RuleSnapshot[] = rules.map((r) => ({
    id: r.id,
    ruleKind: r.ruleKind,
    tagName: r.tagName,
    mealTag: r.mealTag,
    quantity: r.quantity,
    exceptionTag: r.exceptionTag,
    reason: r.reason,
  }));

  const result = evaluateRules({
    recipeName: recipe.name,
    ingredients: ingredientViews,
    recipeMealTags,
    rules: ruleSnapshots,
  });

  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      isApproved: result.isApproved,
      isNormalized: true,
      rejectionReasons: result.rejectionReasons,
    },
  });

  logger.info(
    {
      recipeId,
      recipeName: recipe.name,
      isApproved: result.isApproved,
      rulesEvaluated: rules.length,
      rejectionCount: result.rejectionReasons.length,
    },
    'validated',
  );

  return result;
}
