import { readFileSync } from 'node:fs';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Массовый импорт каталога Пятёрочки из распаршенного data/ingredients_spb.json
 * в таблицу ingredients (source=FIVEKA). Идемпотентно: пропускает уже существующие
 * по externalCode (`plu:<plu>`). КБЖУ — из product.kbju (на 100г), цена — prices.regular,
 * pricePer100g = regular / weight.grams × 100.
 *
 * Запуск: DATABASE_URL=... npx tsx prisma/import-fiveka-catalog.ts
 */
const prisma = new PrismaClient();
const DATA = '/Users/victor_mac/Питание/App/data/ingredients_spb.json';

interface SpbProduct {
  plu: number;
  name: string;
  weight?: { grams?: number | null };
  prices?: { regular?: number | null };
  kbju?: { kcal?: number; protein?: number; fat?: number; carbs?: number } | null;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

async function main() {
  const products = JSON.parse(readFileSync(DATA, 'utf-8')).products as Record<string, SpbProduct>;
  const entries = Object.values(products);
  console.log(`в файле продуктов: ${entries.length}`);

  // Уже импортированные plu:* — чтобы не задваивать.
  const existing = await prisma.ingredient.findMany({
    where: { externalCode: { startsWith: 'plu:' } },
    select: { externalCode: true },
  });
  const have = new Set(existing.map((e) => e.externalCode));
  console.log(`уже в БД (plu:*): ${have.size}`);

  const rows: Prisma.IngredientCreateManyInput[] = [];
  for (const p of entries) {
    const code = `plu:${p.plu}`;
    if (have.has(code)) continue;
    const grams = num(p.weight?.grams);
    const reg = num(p.prices?.regular);
    const pricePer100g = grams && grams > 0 && reg !== null ? Math.round((reg / grams) * 10000) / 100 : null;
    rows.push({
      name: p.name,
      source: 'FIVEKA',
      externalCode: code,
      kcal100g: num(p.kbju?.kcal),
      protein100g: num(p.kbju?.protein),
      fat100g: num(p.kbju?.fat),
      carbs100g: num(p.kbju?.carbs),
      pricePer100g,
      weightG: grams ? Math.round(grams) : null,
      unit: 'g',
    });
  }

  console.log(`к вставке: ${rows.length}`);
  let inserted = 0;
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await prisma.ingredient.createMany({ data: rows.slice(i, i + BATCH) });
    inserted += res.count;
    console.log(`  …вставлено ${inserted}/${rows.length}`);
  }

  const total = await prisma.ingredient.count();
  console.log(`✅ импорт завершён. вставлено: ${inserted}. всего ингредиентов в БД: ${total}`);
}

main()
  .catch((e) => {
    console.error('import failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
