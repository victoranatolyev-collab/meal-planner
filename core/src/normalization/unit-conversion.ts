import { prisma } from '../db.js';
import type { UnitConversion } from '@prisma/client';

/**
 * Кэш unit_conversions в памяти. Загружается при первом обращении из БД.
 * Инвалидируется только при перезапуске процесса (таблица меняется редко).
 */
let cache: UnitConversion[] | null = null;

async function loadConversions(): Promise<UnitConversion[]> {
  if (cache) return cache;
  cache = await prisma.unitConversion.findMany();
  return cache;
}

/**
 * Сбрасывает in-memory кэш unit_conversions. Используется в тестах + после admin-update.
 */
export function clearUnitConversionsCache(): void {
  cache = null;
}

/**
 * Pure-функция: маппит (qty, unit, tags) → грамм используя список conversions.
 *
 * Стратегия:
 *  1. Найти ingredient-specific conversion (по unit + tag из ingredientTags)
 *  2. Иначе universal (unit + ingredientTag=null)
 *  3. Иначе null + причина
 *
 * Регистронечувствительно + trim.
 */
export function convertToGramsWith(
  conversions: Pick<UnitConversion, 'unit' | 'gramsPerUnit' | 'ingredientTag'>[],
  qty: number,
  unit: string,
  ingredientTags: string[] = [],
): { grams: number | null; matchedRow: 'tag-specific' | 'universal' | null; reason: string | null } {
  const normalizedUnit = unit.trim().toLowerCase();

  // 1. Try tag-specific (если ingredient имеет тег, для которого есть conversion).
  for (const conv of conversions) {
    if (!conv.ingredientTag) continue;
    if (conv.unit.toLowerCase() !== normalizedUnit) continue;
    if (ingredientTags.includes(conv.ingredientTag)) {
      const grams = Math.round(qty * Number(conv.gramsPerUnit));
      return { grams, matchedRow: 'tag-specific', reason: null };
    }
  }

  // 2. Universal (ingredientTag == null).
  for (const conv of conversions) {
    if (conv.ingredientTag) continue;
    if (conv.unit.toLowerCase() === normalizedUnit) {
      const grams = Math.round(qty * Number(conv.gramsPerUnit));
      return { grams, matchedRow: 'universal', reason: null };
    }
  }

  return {
    grams: null,
    matchedRow: null,
    reason: `unit '${unit}' не найден в unit_conversions (нет универсальной conversion, нет per-tag для ${ingredientTags.length ? ingredientTags.join(',') : '<no tags>'})`,
  };
}

/**
 * DB-wrapper: загружает conversions (кэшируется) и вызывает pure-функцию.
 */
export async function convertToGrams(
  qty: number,
  unit: string,
  ingredientTags: string[] = [],
) {
  const conversions = await loadConversions();
  return convertToGramsWith(conversions, qty, unit, ingredientTags);
}
