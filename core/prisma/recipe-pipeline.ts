import { PrismaClient } from '@prisma/client';
import { searchRecipes, normalizeRecipe, validateRecipe } from '../src/index.js';

/**
 * Тест полного пайплайна одной партии: scr-search-recipes → normalize → validate.
 * Запуск: DATABASE_URL=... npx tsx prisma/recipe-pipeline.ts <count> "<тема/notes>"
 * Печатает по каждому рецепту: привязку продуктов (raw→catalog, similarity, г), КБЖУ, вердикт.
 */
const prisma = new PrismaClient();
const USER_ID = 'dec00000-0000-0000-0000-000000000001';

async function main() {
  const count = Number(process.argv[2] ?? 5);
  const theme = process.argv[3] ?? 'разнообразные сбалансированные блюда (завтрак/обед/ужин)';

  console.log(`🔎 Поиск ${count} блюд (тема: «${theme}») через Claude…`);
  const res = await searchRecipes({ userId: USER_ID, count, notes: theme });
  console.log(`сгенерировано: ${res.count}\n`);

  let approved = 0;
  for (const r of res.created) {
    const norm = await normalizeRecipe(r.id);
    const val = await validateRecipe(r.id);
    if (val.isApproved) approved += 1;

    console.log(`● ${r.name}  [теги: ${r.mealTags.join(', ') || '—'}]`);
    console.log(`   состав (raw → каталог, similarity, г):`);
    for (const m of norm.matched) {
      const flag = m.warning ? `  ⚠ ${m.warning}` : '';
      console.log(
        `     "${m.rawName}" ${m.rawQty}${m.rawUnit} → "${m.matchedName}" (sim ${m.similarity.toFixed(2)}, ${m.qtyG ?? '?'}г)${flag}`,
      );
    }
    for (const u of norm.unmatched) console.log(`     ✗ не привязан: "${u.rawName}" (${u.reason})`);
    console.log(
      `   КБЖУ: ${Math.round(norm.totals.kcal)} ккал · Б ${norm.totals.proteinG} · Ж ${norm.totals.fatG} · У ${norm.totals.carbsG}`,
    );
    console.log(
      `   вердикт: ${val.isApproved ? '✅ APPROVED → в пуле' : '⛔ REJECTED'} ${val.rejectionReasons.length ? '(' + val.rejectionReasons.join('; ') + ')' : ''}\n`,
    );
  }

  const pool = await prisma.recipe.count({
    where: { userId: USER_ID, isApproved: true, isNormalized: true },
  });
  console.log(`📊 одобрено в этой партии: ${approved}/${res.count}. Всего в пуле: ${pool}`);
}

main()
  .catch((e) => {
    console.error('pipeline failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
