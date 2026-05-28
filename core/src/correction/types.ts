export interface Macros {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** Сверка факт vs план за день: остаток (target − actual). */
export interface DayCorrection {
  date: string;
  target: Macros;
  actual: Macros;
  remaining: Macros; // target − actual (отрицательное = перебор)
}
