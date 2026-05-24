import { Prisma, IngredientSource } from '@prisma/client';
import type { LlProduct } from './types.js';

/**
 * Маппит сырой LlProduct в форму, готовую к Prisma upsert в ingredients.
 *
 * Решения:
 *  - source всегда LL для этого парсера
 *  - external_code = String(PLU) (PLU LL — цифры, в БД храним строкой для единообразия)
 *  - КБЖУ на 100г напрямую (LL отдаёт уже на 100г)
 *  - price_per_100g вычисляем из (regular price / weight_g) * 100 если есть оба значения,
 *    иначе null. Discount игнорируем — нестабильный сигнал.
 *  - pack_size = weight.label если есть, иначе null
 *  - unit = uom (default 'шт' → 'piece', 'кг' → 'kg', и т.п.). Для простоты сейчас оставляем русское.
 *
 * Декимал-поля передаём как Prisma.Decimal — точные расчёты.
 */
export function mapLlToIngredient(
  product: LlProduct,
): Prisma.IngredientCreateInput {
  const weightG = product.weight?.grams ?? null;
  const regularPrice = product.prices?.regular ?? null;

  // price per 100g: рассчитываем только если есть оба значения и weightG > 0
  let pricePer100g: Prisma.Decimal | null = null;
  if (regularPrice !== null && weightG !== null && weightG > 0) {
    pricePer100g = new Prisma.Decimal((regularPrice / weightG) * 100).toDecimalPlaces(2);
  }

  const k = product.kbju;
  return {
    name: product.name,
    source: IngredientSource.LL,
    externalCode: String(product.plu),
    kcal100g: k?.kcal != null ? new Prisma.Decimal(k.kcal) : null,
    protein100g: k?.protein != null ? new Prisma.Decimal(k.protein) : null,
    fat100g: k?.fat != null ? new Prisma.Decimal(k.fat) : null,
    carbs100g: k?.carbs != null ? new Prisma.Decimal(k.carbs) : null,
    pricePer100g,
    weightG: weightG ?? null,
    packSize: product.weight?.label ?? null,
    unit: product.uom ?? 'шт',
  };
}
