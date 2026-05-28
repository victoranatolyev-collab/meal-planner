import type { DraftDay } from './schemas.js';

export interface ApprovedRecipe {
  id: string;
  name: string;
}

export interface ResolvedPlan {
  days: DraftDay[];
  /** Сколько позиций пришлось заменить (recipeId не из approved-пула). */
  substitutions: number;
}

/**
 * Pure greedy-fallback: каждая позиция, чей `recipeId` НЕ входит в approved-пул,
 * заменяется на рецепт из пула (round-robin). Гарантирует, что все ссылки указывают
 * на реальные одобренные рецепты.
 *
 * Зачем: (1) stub llm-service отдаёт фикстуру с placeholder id; (2) в api-режиме LLM
 * может галлюцинировать id. Пул = только approved-рецепты (прошли scr-validate-recipes),
 * поэтому замена сохраняет валидность на уровне рецепта. Week-level правила
 * (MIN/MAX_PER_WEEK) — отдельный проход (refinement).
 */
export function resolveDraftToApproved(days: DraftDay[], pool: ApprovedRecipe[]): ResolvedPlan {
  const first = pool[0];
  if (!first) {
    throw new Error('Пустой approved-пул — нечем заполнять план');
  }
  const poolIds = new Set(pool.map((r) => r.id));
  let roundRobin = 0;
  let substitutions = 0;

  const resolvedDays: DraftDay[] = days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => {
        if (poolIds.has(item.recipeId)) return item;
        const replacement = pool[roundRobin % pool.length] ?? first;
        roundRobin += 1;
        substitutions += 1;
        return { ...item, recipeId: replacement.id };
      }),
    })),
  }));

  return { days: resolvedDays, substitutions };
}
