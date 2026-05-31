import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

/**
 * CRUD над рецептами (scr-edit-recipes): ручное создание/правка/удаление блюд пула.
 * Состав задаётся именами ингредиентов + граммовкой; ингредиент резолвится по имени
 * (case-insensitive), иначе создаётся как CUSTOM с нулевым КБЖУ. КБЖУ-итоги рецепта —
 * ручные поля (на пуле планировщик использует именно totals + tags).
 */

const ingredientLineSchema = z
  .object({
    ingredientId: z.string().uuid().optional(), // из справочника (приоритет)
    name: z.string().min(1).max(200).optional(), // фоллбэк: резолв по имени / создание CUSTOM
    qtyG: z.number().int().positive().max(5000),
    freshAddon: z.boolean().optional(),
  })
  .refine((v) => v.ingredientId || v.name, { message: 'Нужен ingredientId или name' });

export const recipeCreateSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  instructions: z.string().max(5000).default(''),
  tags: z.array(z.string().min(1).max(60)).max(30).default([]),
  kcal: z.number().nonnegative().max(20000).default(0),
  proteinG: z.number().nonnegative().max(2000).default(0),
  fatG: z.number().nonnegative().max(2000).default(0),
  carbsG: z.number().nonnegative().max(2000).default(0),
  ingredients: z.array(ingredientLineSchema).max(40).default([]),
  isApproved: z.boolean().default(true),
  isNormalized: z.boolean().default(true),
});
export type RecipeCreate = z.infer<typeof recipeCreateSchema>;

export const recipeUpdateSchema = recipeCreateSchema.partial().omit({ userId: true });
export type RecipeUpdate = z.infer<typeof recipeUpdateSchema>;

/** Резолвит ингредиент по имени (CI) или создаёт CUSTOM с нулевым КБЖУ. Возвращает id. */
async function resolveIngredientId(name: string): Promise<string> {
  const found = await prisma.ingredient.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (found) return found.id;
  const created = await prisma.ingredient.create({
    data: { name, source: 'CUSTOM', unit: 'g', kcal100g: 0, protein100g: 0, fat100g: 0, carbs100g: 0 },
    select: { id: true },
  });
  return created.id;
}

interface IngRow {
  ingredientId: string;
  qtyG: number;
  freshAddon: boolean;
}

/** Резолвит строки состава в ingredientId (справочник / по имени / создание CUSTOM). */
async function buildIngredientRows(ings: RecipeCreate['ingredients']): Promise<IngRow[]> {
  const rows: IngRow[] = [];
  for (const ing of ings) {
    const ingredientId = ing.ingredientId ?? (await resolveIngredientId(ing.name as string));
    rows.push({ ingredientId, qtyG: ing.qtyG, freshAddon: ing.freshAddon ?? false });
  }
  return rows;
}

interface Totals {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** Авторитетный расчёт КБЖУ рецепта из состава: Σ(КБЖУ ингредиента/100г × граммы/100). */
async function computeTotals(rows: IngRow[]): Promise<Totals> {
  const ids = [...new Set(rows.map((r) => r.ingredientId))];
  const ings = await prisma.ingredient.findMany({
    where: { id: { in: ids } },
    select: { id: true, kcal100g: true, protein100g: true, fat100g: true, carbs100g: true },
  });
  const byId = new Map(ings.map((i) => [i.id, i]));
  const t: Totals = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };
  for (const row of rows) {
    const ing = byId.get(row.ingredientId);
    if (!ing) continue;
    const f = row.qtyG / 100;
    t.kcal += Number(ing.kcal100g ?? 0) * f;
    t.proteinG += Number(ing.protein100g ?? 0) * f;
    t.fatG += Number(ing.fat100g ?? 0) * f;
    t.carbsG += Number(ing.carbs100g ?? 0) * f;
  }
  return {
    kcal: Math.round(t.kcal),
    proteinG: Math.round(t.proteinG * 10) / 10,
    fatG: Math.round(t.fatG * 10) / 10,
    carbsG: Math.round(t.carbsG * 10) / 10,
  };
}

export async function createRecipe(input: RecipeCreate) {
  const rows = await buildIngredientRows(input.ingredients);
  // КБЖУ из состава, если он есть; иначе — ручные поля input (фоллбэк).
  const totals = rows.length
    ? await computeTotals(rows)
    : { kcal: input.kcal, proteinG: input.proteinG, fatG: input.fatG, carbsG: input.carbsG };

  const recipe = await prisma.recipe.create({
    data: {
      userId: input.userId,
      name: input.name,
      instructions: input.instructions,
      isRelevant: true,
      isNormalized: input.isNormalized,
      isApproved: input.isApproved,
      totalKcal: totals.kcal,
      totalProteinG: totals.proteinG,
      totalFatG: totals.fatG,
      totalCarbsG: totals.carbsG,
      source: 'MANUAL',
    },
    select: { id: true },
  });
  if (input.tags.length) {
    await prisma.recipeTag.createMany({
      data: input.tags.map((tagName) => ({ recipeId: recipe.id, tagName })),
      skipDuplicates: true,
    });
  }
  if (rows.length) {
    await prisma.recipeIngredient.createMany({
      data: rows.map((r) => ({ recipeId: recipe.id, ...r })),
    });
  }
  return { id: recipe.id };
}

/** Обновляет рецепт. Поля, которых нет в input, не трогаются; tags/ingredients (если переданы) пересоздаются. */
export async function updateRecipe(id: string, input: RecipeUpdate) {
  const data: Prisma.RecipeUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.instructions !== undefined) data.instructions = input.instructions;
  if (input.isApproved !== undefined) data.isApproved = input.isApproved;
  if (input.isNormalized !== undefined) data.isNormalized = input.isNormalized;
  // Ручные totals применяем только если состав НЕ передан (иначе он авторитетнее — см. ниже).
  if (input.ingredients === undefined) {
    if (input.kcal !== undefined) data.totalKcal = input.kcal;
    if (input.proteinG !== undefined) data.totalProteinG = input.proteinG;
    if (input.fatG !== undefined) data.totalFatG = input.fatG;
    if (input.carbsG !== undefined) data.totalCarbsG = input.carbsG;
  }

  // Состав передан → пересоздаём и пересчитываем КБЖУ из него (авторитетно).
  if (input.ingredients !== undefined) {
    const rows = await buildIngredientRows(input.ingredients);
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
    if (rows.length) {
      await prisma.recipeIngredient.createMany({ data: rows.map((r) => ({ recipeId: id, ...r })) });
    }
    const totals = await computeTotals(rows);
    data.totalKcal = totals.kcal;
    data.totalProteinG = totals.proteinG;
    data.totalFatG = totals.fatG;
    data.totalCarbsG = totals.carbsG;
  }

  await prisma.recipe.update({ where: { id }, data });

  if (input.tags !== undefined) {
    await prisma.recipeTag.deleteMany({ where: { recipeId: id } });
    if (input.tags.length) {
      await prisma.recipeTag.createMany({
        data: input.tags.map((tagName) => ({ recipeId: id, tagName })),
        skipDuplicates: true,
      });
    }
  }
  return { id };
}

/**
 * Удаляет рецепт. PlanMealItem.recipe = onDelete Restrict → сперва убираем позиции плана,
 * ссылающиеся на рецепт (дневник переживает через SetNull). Состав/теги уходят каскадом.
 */
export async function deleteRecipe(id: string) {
  await prisma.$transaction([
    prisma.planMealItem.deleteMany({ where: { recipeId: id } }),
    prisma.recipe.delete({ where: { id } }),
  ]);
  return { id };
}
