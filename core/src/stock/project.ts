import type { StockProjectionLine } from './types.js';

/**
 * Pure (scr-calc-stock): проекция остатков.
 * projectedG = baseline (инвентаризация) + bought (заказы) − consumed (дневник).
 * Отрицательное projectedG = дефицит (съели/нужно больше, чем есть + куплено).
 *
 * Без мутации — это отчёт. Применение к StockItem (новая инвентаризация) — отдельный шаг.
 */
export function projectStock(args: {
  baseline: Map<string, number>;
  bought: Map<string, number>;
  consumed: Map<string, number>;
}): StockProjectionLine[] {
  const ids = new Set<string>([
    ...args.baseline.keys(),
    ...args.bought.keys(),
    ...args.consumed.keys(),
  ]);

  const lines: StockProjectionLine[] = [];
  for (const ingredientId of ids) {
    const baselineG = args.baseline.get(ingredientId) ?? 0;
    const boughtG = args.bought.get(ingredientId) ?? 0;
    const consumedG = args.consumed.get(ingredientId) ?? 0;
    lines.push({
      ingredientId,
      baselineG,
      boughtG,
      consumedG,
      projectedG: baselineG + boughtG - consumedG,
    });
  }
  return lines;
}
