import { Prisma } from '@prisma/client';
import pino from 'pino';
import { prisma } from '../db.js';
import { findBestIngredientMatch } from './fuzzy-match.js';
import { convertToGrams } from './unit-conversion.js';
import type {
  MatchedIngredient,
  NormalizationResult,
  RawIngredient,
  MatchConfig,
} from './types.js';
import { DEFAULT_MATCH_CONFIG } from './types.js';

const logger = pino({ name: 'normalizer:recipe' });

const WEAK_MATCH_THRESHOLD = 0.5; // ниже — warning «weak match»

/**
 * Нормализует один рецепт: маппит raw-ингредиенты на catalog, конвертирует qty в граммы,
 * создаёт RecipeIngredient rows, считает суммарные КБЖУ.
 *
 * Источник raw-данных: `recipe.rawIngredients` (jsonb, заполняется в scr-search-recipes).
 *
 * Контракт см. ARCHITECTURE §7.3 + scr-normalize-recipe в ROADMAP.
 */
export async function normalizeRecipe(
  recipeId: string,
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): Promise<NormalizationResult> {
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    include: { ingredients: true },
  });

  if (!recipe.rawIngredients) {
    throw new Error(`Recipe ${recipeId} has no rawIngredients — nothing to normalize`);
  }

  const raw = recipe.rawIngredients as unknown as RawIngredient[];

  const matched: MatchedIngredient[] = [];
  const unmatched: Array<{ rawName: string; reason: string }> = [];
  const warnings: string[] = [];
  // Накапливаем сразу для totals — у нас на руках полный ingredient после match.
  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  for (const rawItem of raw) {
    const match = await findBestIngredientMatch(rawItem.name, config);

    if (!match) {
      unmatched.push({ rawName: rawItem.name, reason: `no match >${config.threshold}` });
      warnings.push(`unmatched: "${rawItem.name}"`);
      continue;
    }

    const conv = await convertToGrams(rawItem.qty, rawItem.unit, match.ingredient.tags);

    let warning: string | null = null;
    if (match.similarity < WEAK_MATCH_THRESHOLD) {
      warning = `weak match: similarity=${match.similarity.toFixed(2)} (порог уверенности ${WEAK_MATCH_THRESHOLD})`;
      warnings.push(`weak match для "${rawItem.name}" → "${match.ingredient.name}" (${match.similarity.toFixed(2)})`);
    }
    if (conv.grams === null) {
      warning = (warning ? warning + '; ' : '') + (conv.reason ?? 'unit conversion failed');
      warnings.push(`conversion failed: ${rawItem.qty} ${rawItem.unit} (${rawItem.name})`);
    }

    matched.push({
      rawName: rawItem.name,
      rawQty: rawItem.qty,
      rawUnit: rawItem.unit,
      ingredientId: match.ingredient.id,
      matchedName: match.ingredient.name,
      similarity: match.similarity,
      qtyG: conv.grams,
      warning,
    });

    // Накопление totals: kcal_100g * (qty_g / 100). Пропускаем если qty_g или КБЖУ нулевые.
    if (conv.grams !== null) {
      const factor = conv.grams / 100;
      if (match.ingredient.kcal100g !== null) totalKcal += Number(match.ingredient.kcal100g) * factor;
      if (match.ingredient.protein100g !== null) totalProtein += Number(match.ingredient.protein100g) * factor;
      if (match.ingredient.fat100g !== null) totalFat += Number(match.ingredient.fat100g) * factor;
      if (match.ingredient.carbs100g !== null) totalCarbs += Number(match.ingredient.carbs100g) * factor;
    }
  }

  const totals = {
    kcal: round2(totalKcal),
    proteinG: round2(totalProtein),
    fatG: round2(totalFat),
    carbsG: round2(totalCarbs),
  };

  // Persist: drop old recipe_ingredients, insert new, update Recipe totals + flag.
  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId } }),
    prisma.recipeIngredient.createMany({
      data: matched
        .filter((m) => m.qtyG !== null)
        .map((m) => ({
          recipeId,
          ingredientId: m.ingredientId,
          qtyG: m.qtyG!,
          freshAddon: false,
          note: m.warning,
        })),
      skipDuplicates: true,
    }),
    prisma.recipe.update({
      where: { id: recipeId },
      data: {
        isNormalized: true,
        totalKcal: new Prisma.Decimal(totals.kcal),
        totalProteinG: new Prisma.Decimal(totals.proteinG),
        totalFatG: new Prisma.Decimal(totals.fatG),
        totalCarbsG: new Prisma.Decimal(totals.carbsG),
      },
    }),
  ]);

  logger.info(
    {
      recipeId,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      warnings: warnings.length,
      totals,
    },
    'normalized',
  );

  return { recipeId, matched, unmatched, totals, warnings };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
