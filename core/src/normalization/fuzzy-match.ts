import { prisma } from '../db.js';
import type { Ingredient } from '@prisma/client';
import { DEFAULT_MATCH_CONFIG, type MatchConfig } from './types.js';

/**
 * Возвращает best match для rawName из catalog ingredients используя pg_trgm.
 *
 * Скоринг: GREATEST(word_similarity(raw, name), similarity(name, raw)).
 * word_similarity ловит короткий запрос внутри многословного ритейл-названия
 * («Яйцо» → «Яйцо куриное Красная Цена С2 10шт.»), где обычный similarity проваливается
 * из-за разницы длины. similarity оставлен как доп. сигнал (точное короткое имя).
 * Фильтр: word_similarity > 0.5 ИЛИ similarity > threshold. Тай-брейк — короче имя
 * (запрос = бо́льшая доля названия = вероятнее искомый продукт).
 *
 * Использует GIN trigram-индекс (gin_trgm_ops поддерживает и similarity, и word_similarity).
 */
const WORD_SIM_THRESHOLD = 0.5;

export async function findBestIngredientMatch(
  rawName: string,
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): Promise<{ ingredient: Ingredient; similarity: number } | null> {
  const rows = await prisma.$queryRaw<Array<Ingredient & { similarity: number }>>`
    SELECT
      id, name, source, external_code AS "externalCode",
      kcal_100g AS "kcal100g", protein_100g AS "protein100g",
      fat_100g AS "fat100g", carbs_100g AS "carbs100g",
      price_per_100g AS "pricePer100g", weight_g AS "weightG",
      pack_size AS "packSize", unit, tags,
      created_at AS "createdAt", updated_at AS "updatedAt",
      GREATEST(word_similarity(${rawName}, name), similarity(name, ${rawName})) AS similarity
    FROM ingredients
    WHERE (word_similarity(${rawName}, name) > ${WORD_SIM_THRESHOLD}
           OR similarity(name, ${rawName}) > ${config.threshold})
      AND name NOT LIKE 'ZZ_TEST_%'
    ORDER BY similarity DESC, length(name) ASC
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0]!;
  const { similarity, ...ingredient } = row;
  return { ingredient: ingredient as Ingredient, similarity };
}
