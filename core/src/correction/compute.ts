import type { DayCorrection, Macros } from './types.js';

const ZERO: Macros = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };

/**
 * Pure (scr-correct-plan): по дням недели — остаток КБЖУ = дневная цель − факт (дневник).
 * remaining < 0 = перебор. Дни без факта → actual = 0 → remaining = target.
 */
export function computeCorrection(args: {
  dailyTarget: Macros;
  dates: string[];
  actualByDate: Map<string, Macros>;
}): DayCorrection[] {
  return args.dates.map((date) => {
    const actual = args.actualByDate.get(date) ?? ZERO;
    return {
      date,
      target: args.dailyTarget,
      actual,
      remaining: {
        kcal: round2(args.dailyTarget.kcal - actual.kcal),
        proteinG: round2(args.dailyTarget.proteinG - actual.proteinG),
        fatG: round2(args.dailyTarget.fatG - actual.fatG),
        carbsG: round2(args.dailyTarget.carbsG - actual.carbsG),
      },
    };
  });
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
