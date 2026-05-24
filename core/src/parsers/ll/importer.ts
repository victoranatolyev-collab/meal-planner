import pino from 'pino';
import { prisma } from '../../db.js';
import { createLlParser } from './parser.js';
import { mapLlToIngredient } from './mapper.js';
import type { LlProduct } from './types.js';

const logger = pino({ name: 'parser:ll' });

/**
 * Запускает полный цикл импорта LL:
 *  1. Парсит через выбранный LlParser
 *  2. INSERT в source_ll (append-only снимок с raw + summary)
 *  3. UPSERT каждой позиции в ingredients по unique (name, source, pack_size)
 *     → повторный запуск не дублирует, обновляет цены/КБЖУ
 *
 * Возвращает summary для логов/мониторинга.
 */
export async function importLl(): Promise<{
  sourceId: string;
  productsTotal: number;
  ingredientsUpserted: number;
}> {
  const start = Date.now();
  const parser = await createLlParser();
  const result = await parser.parse();

  logger.info(
    { productCount: result.products.length, storeSap: result.meta.storeSap },
    'parsed source data',
  );

  // 1. Save raw snapshot to source_ll (append-only).
  const source = await prisma.sourceLl.create({
    data: {
      raw: result as unknown as object,
      summary: {
        storeSap: result.meta.storeSap,
        storeAddress: result.meta.storeAddress ?? null,
        productCount: result.meta.productCount,
        withKbjuCount: result.meta.withKbjuCount,
      },
    },
  });

  // 2. UPSERT each product into ingredients.
  let upserted = 0;
  for (const product of result.products) {
    await upsertIngredient(product);
    upserted += 1;
  }

  const elapsedMs = Date.now() - start;
  logger.info(
    { sourceId: source.id, upserted, elapsedMs },
    'import finished',
  );

  return {
    sourceId: source.id,
    productsTotal: result.products.length,
    ingredientsUpserted: upserted,
  };
}

async function upsertIngredient(product: LlProduct): Promise<void> {
  const data = mapLlToIngredient(product);
  // Unique key: (name, source, pack_size). Если pack_size null — Postgres
  // считает null != null в unique, поэтому позиции без packSize всегда вставляются.
  // На практике все позиции LL имеют weight.label, так что packSize обычно не null.
  await prisma.ingredient.upsert({
    where: {
      uniq_name_source_pack: {
        name: data.name,
        source: data.source,
        packSize: data.packSize ?? '',
      },
    },
    update: {
      kcal100g: data.kcal100g,
      protein100g: data.protein100g,
      fat100g: data.fat100g,
      carbs100g: data.carbs100g,
      pricePer100g: data.pricePer100g,
      weightG: data.weightG,
      externalCode: data.externalCode,
    },
    create: data,
  });
}
