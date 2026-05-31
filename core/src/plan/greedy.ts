import type { DraftDay } from './schemas.js';

/** Кандидат-рецепт для greedy-композера (КБЖУ на 1 порцию + теги). */
export interface GreedyRecipe {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  mealTags: string[];
}

export interface GreedyTargets {
  kcalPerDay: number;
  proteinGPerDay: number;
  fatGPerDay: number;
  carbsGPerDay: number;
}

export interface GreedyDayInput {
  date: string;
  dayType?: string;
}

/** Раскладка приёма: имя, время, доля дневной калорийности, признак десертного слота. */
const MEAL_SLOTS: Array<{ name: string; time: string; kcalShare: number; dessert?: boolean }> = [
  { name: 'Завтрак', time: '08:30', kcalShare: 0.27 },
  { name: 'Обед', time: '14:00', kcalShare: 0.33 },
  { name: 'Ужин', time: '19:00', kcalShare: 0.28 },
  { name: 'Перекус', time: '21:30', kcalShare: 0.12, dessert: true },
];

const DESSERT_TAGS = ['десерт', 'dessert', 'sweet', 'перекус', 'snack'];

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Детерминированный greedy-композер плана недели по КБЖУ.
 *
 * На каждый день и каждый приём подбирает рецепт из пула так, чтобы:
 *  - калорийность приёма ≈ доля дневной цели (Завтрак 30% / Обед 40% / Ужин 30%);
 *  - на «тренировочный» обед предпочитается рецепт с белковым/post_workout-тегом;
 *  - рецепты разнообразились по дням (ротация со сдвигом на индекс дня).
 *
 * portionFactor масштабирует рецепт под целевую калорийность приёма (clamp 0.5..2.5).
 * Результат — то же дерево DraftDay[], что отдаёт LLM-черновик (полная совместимость с persist/resolve).
 *
 * Зачем не LLM по умолчанию: stub отдаёт фикстуру (без учёта целей), а реальный Claude через
 * CLI в dev слишком медленный/нестабилен. Greedy — мгновенный и детерминированный baseline.
 */
export function composePlanGreedy(
  targets: GreedyTargets,
  days: GreedyDayInput[],
  recipes: GreedyRecipe[],
): { days: DraftDay[] } {
  if (recipes.length === 0) {
    throw new Error('Пустой пул рецептов — greedy-композеру нечем заполнять план');
  }

  const proteinRecipes = recipes.filter(
    (r) => r.mealTags.some((t) => ['белок', 'protein', 'post_workout', 'железо'].includes(t)) || r.proteinG >= 30,
  );
  const dessertRecipes = recipes.filter((r) => r.mealTags.some((t) => DESSERT_TAGS.includes(t)));

  const resultDays: DraftDay[] = days.map((day, di) => {
    const isTraining = (day.dayType ?? '').toLowerCase().includes('train');

    const meals = MEAL_SLOTS.map((slot, si) => {
      const mealKcalTarget = targets.kcalPerDay * slot.kcalShare;

      // Выбор пула: десертный слот → десерты (если есть); тренировочный обед → белковый подпул.
      let pool = recipes;
      const wantProtein = isTraining && slot.name === 'Обед' && proteinRecipes.length > 0;
      const wantDessert = !!slot.dessert && dessertRecipes.length > 0;
      if (wantDessert) pool = dessertRecipes;
      else if (wantProtein) pool = proteinRecipes;
      const recipe = pool[(di + si) % pool.length] ?? recipes[0]!;

      const baseKcal = recipe.kcal > 0 ? recipe.kcal : targets.kcalPerDay / 4;
      // Десерт держим компактным (≤1.5), основные приёмы — до 2.0 (реалистичнее, чем прежние 2.5).
      const maxPF = slot.dessert ? 1.5 : 2.0;
      const portionFactor = round2(clamp(mealKcalTarget / baseKcal, 0.5, maxPF));

      return {
        name: slot.name,
        time: slot.time,
        mealTags: wantDessert ? ['десерт'] : wantProtein ? ['post_workout'] : [],
        items: [{ recipeId: recipe.id, portionFactor, fromStock: false, tail: slot.dessert ?? false }],
      };
    });

    return {
      date: day.date,
      ...(day.dayType ? { dayType: day.dayType } : {}),
      meals,
    };
  });

  return { days: resultDays };
}
