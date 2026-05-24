import { prisma } from '../db.js';
import type { Ingredient } from '@prisma/client';
import { DEFAULT_MATCH_CONFIG, type MatchConfig } from './types.js';

/**
 * Возвращает best match для rawName из catalog ingredients используя pg_trgm.
 * Если similarity < threshold — возвращает null.
 *
 * SQL: `SELECT *, similarity(name, $1) FROM ingredients
 *       WHERE similarity(name, $1) > $threshold
 *       ORDER BY similarity DESC LIMIT 1`.
 *
 * Использует GIN trigram-индекс (см. миграцию pg_trgm_and_units).
 */
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
      similarity(name, ${rawName}) AS similarity
    FROM ingredients
    WHERE similarity(name, ${rawName}) > ${config.threshold}
    ORDER BY similarity DESC
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0]!;
  const { similarity, ...ingredient } = row;
  return { ingredient: ingredient as Ingredient, similarity };
}
