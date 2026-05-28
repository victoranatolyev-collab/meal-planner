export interface Macros {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
}

/**
 * Pure: масштабирует КБЖУ рецепта на множитель порции (для записи в дневник).
 * null-safe: если у рецепта поле не посчитано (null) — остаётся null.
 */
export function scaleMacros(totals: Macros, factor: number): Macros {
  const s = (v: number | null) => (v === null ? null : Math.round(v * factor * 100) / 100);
  return {
    kcal: s(totals.kcal),
    proteinG: s(totals.proteinG),
    fatG: s(totals.fatG),
    carbsG: s(totals.carbsG),
  };
}
