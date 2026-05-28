import pino from 'pino';
import { prisma } from '../db.js';
import { runLlmJob } from '../recipes/llm-client.js';
import { calcPlanOutputSchema } from './schemas.js';
import { resolveDraftToApproved, type ApprovedRecipe } from './resolve.js';

const logger = pino({ name: 'plan:generate' });

export interface GenerateWeekPlanArgs {
  userId: string;
  weekIso: string; // "2026-W22"
  startDate: string; // ISO date (понедельник недели)
  dayCount?: number; // default 7
  dayTypes?: (string | undefined)[];
}

export interface GenerateWeekPlanResult {
  weekPlanId: string;
  weekIso: string;
  days: number;
  meals: number;
  items: number;
  /** Сколько LLM-позиций заменено greedy-фоллбэком (placeholder/неизвестный recipeId). */
  substitutions: number;
}

/**
 * scr-calc-week-plan (orchestration, подзадача 2/3).
 *
 * Hybrid: targets + пул approved-рецептов → llm-service `calc-plan` (черновик) →
 * greedy resolve (неизвестные recipeId → из пула) → persist в дерево week_plans.
 * Цели КБЖУ + бюджет — SNAPSHOT в план (из NutritionTarget).
 *
 * Регенерация: существующий план на эту неделю удаляется (cascade) и пересоздаётся.
 */
export async function generateWeekPlan(args: GenerateWeekPlanArgs): Promise<GenerateWeekPlanResult> {
  const dayCount = args.dayCount ?? 7;

  // 1. Snapshot целей.
  const target = await prisma.nutritionTarget.findUnique({ where: { userId: args.userId } });
  if (!target) {
    throw new Error(`Нет nutrition_targets для ${args.userId} — задай цели (/rules) перед планом`);
  }

  // 2. Пул одобренных + нормализованных рецептов.
  const recipes = await prisma.recipe.findMany({
    where: { userId: args.userId, isApproved: true, isNormalized: true },
    select: {
      id: true,
      name: true,
      totalKcal: true,
      totalProteinG: true,
      totalFatG: true,
      totalCarbsG: true,
      tags: { select: { tagName: true } },
    },
  });
  if (recipes.length === 0) {
    throw new Error(`Нет одобренных рецептов для ${args.userId} — найди/одобри рецепты перед планом`);
  }
  const pool: ApprovedRecipe[] = recipes.map((r) => ({ id: r.id, name: r.name }));

  // 3. Дни недели.
  const days = buildDays(args.startDate, dayCount, args.dayTypes);
  const last = days.at(-1);
  const endDate = last ? last.date : args.startDate;

  // 4. LLM-черновик.
  const draft = await runLlmJob({
    kind: 'calc-plan',
    userId: args.userId,
    responseSchema: calcPlanOutputSchema,
    input: {
      weekIso: args.weekIso,
      startDate: args.startDate,
      endDate,
      targets: {
        kcalPerDay: Number(target.kcalPerDay),
        proteinGPerDay: Number(target.proteinGPerDay),
        fatGPerDay: Number(target.fatGPerDay),
        carbsGPerDay: Number(target.carbsGPerDay),
      },
      days,
      recipes: recipes.map((r) => ({
        id: r.id,
        name: r.name,
        kcal: Number(r.totalKcal ?? 0),
        proteinG: Number(r.totalProteinG ?? 0),
        fatG: Number(r.totalFatG ?? 0),
        carbsG: Number(r.totalCarbsG ?? 0),
        mealTags: r.tags.map((t) => t.tagName),
      })),
    },
  });

  // 5. Greedy resolve неизвестных recipeId.
  const resolved = resolveDraftToApproved(draft.days, pool);

  let mealCount = 0;
  let itemCount = 0;
  for (const d of resolved.days) {
    for (const m of d.meals) {
      mealCount += 1;
      itemCount += m.items.length;
    }
  }

  // 6. Persist (регенерация: удалить существующий план недели → nested create дерева).
  const weekPlan = await prisma.$transaction(async (tx) => {
    await tx.weekPlan.deleteMany({ where: { userId: args.userId, weekIso: args.weekIso } });
    return tx.weekPlan.create({
      data: {
        userId: args.userId,
        weekIso: args.weekIso,
        startDate: new Date(args.startDate),
        endDate: new Date(endDate),
        status: 'DRAFT',
        kcalTarget: target.kcalPerDay,
        proteinGTarget: target.proteinGPerDay,
        fatGTarget: target.fatGPerDay,
        carbsGTarget: target.carbsGPerDay,
        budgetTargetRub: target.budgetTargetRubPerWeek,
        budgetSoftCapRub: target.budgetSoftCapRubPerWeek,
        days: {
          create: resolved.days.map((d) => ({
            date: new Date(d.date),
            dayType: d.dayType ?? null,
            meals: {
              create: d.meals.map((m, mi) => ({
                name: m.name,
                time: m.time ?? null,
                sortOrder: mi,
                mealTags: m.mealTags,
                items: {
                  create: m.items.map((it, ii) => ({
                    recipeId: it.recipeId,
                    portionFactor: it.portionFactor,
                    fromStock: it.fromStock,
                    tail: it.tail,
                    sortOrder: ii,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  });

  logger.info(
    {
      userId: args.userId,
      weekIso: args.weekIso,
      days: resolved.days.length,
      meals: mealCount,
      items: itemCount,
      substitutions: resolved.substitutions,
    },
    'week plan generated',
  );

  return {
    weekPlanId: weekPlan.id,
    weekIso: args.weekIso,
    days: resolved.days.length,
    meals: mealCount,
    items: itemCount,
    substitutions: resolved.substitutions,
  };
}

/**
 * Чтение плана недели с полным деревом (days → meals → items + рецепт-инфо).
 * Возвращает null, если плана нет. Для REST `GET /api/plans` и агента.
 */
export async function getWeekPlan(userId: string, weekIso: string) {
  return prisma.weekPlan.findUnique({
    where: { uniq_user_week: { userId, weekIso } },
    include: {
      days: {
        orderBy: { date: 'asc' },
        include: {
          meals: {
            orderBy: { sortOrder: 'asc' },
            include: {
              items: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  recipe: {
                    select: {
                      id: true,
                      name: true,
                      totalKcal: true,
                      totalProteinG: true,
                      totalFatG: true,
                      totalCarbsG: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

/** Последовательные `count` дат от startDate (ISO `YYYY-MM-DD`). */
function buildDays(
  startDate: string,
  count: number,
  dayTypes?: (string | undefined)[],
): Array<{ date: string; dayType?: string }> {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const dayType = dayTypes?.[i];
    return dayType ? { date, dayType } : { date };
  });
}
