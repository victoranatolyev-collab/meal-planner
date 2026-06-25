import { PrismaClient } from '@prisma/client';

/**
 * Нормировка порций: блюда с завышенным КБЖУ (LLM задал кол-во на всё блюдо / неск. порций)
 * приводятся к ~1 приёму. servings = round(kcal / REF); если ≥2 — делим состав и итоги на servings.
 * Лёгкие блюда (≤ THRESHOLD) не трогаем. Запуск: DATABASE_URL=... npx tsx prisma/normalize-portions.ts
 */
const prisma = new PrismaClient();
const USER_ID = 'dec00000-0000-0000-0000-000000000001';
const THRESHOLD = 1000; // ниже — считаем уже 1 порцией
const REF = 700; // референс ккал на 1 приём

const r0 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;

async function main() {
  const pool = await prisma.recipe.findMany({
    where: { userId: USER_ID, isApproved: true, isNormalized: true },
    select: { id: true, name: true, totalKcal: true, totalProteinG: true, totalFatG: true, totalCarbsG: true },
  });

  let scaled = 0;
  for (const rec of pool) {
    const kcal = Number(rec.totalKcal ?? 0);
    if (kcal <= THRESHOLD) continue;
    const servings = Math.round(kcal / REF);
    if (servings < 2) continue;
    const s = 1 / servings;

    const ings = await prisma.recipeIngredient.findMany({ where: { recipeId: rec.id }, select: { ingredientId: true, qtyG: true } });
    await prisma.$transaction([
      ...ings.map((i) =>
        prisma.recipeIngredient.update({
          where: { recipeId_ingredientId: { recipeId: rec.id, ingredientId: i.ingredientId } },
          data: { qtyG: Math.max(1, r0(i.qtyG * s)) },
        }),
      ),
      prisma.recipe.update({
        where: { id: rec.id },
        data: {
          totalKcal: r0(kcal * s),
          totalProteinG: r2(Number(rec.totalProteinG ?? 0) * s),
          totalFatG: r2(Number(rec.totalFatG ?? 0) * s),
          totalCarbsG: r2(Number(rec.totalCarbsG ?? 0) * s),
        },
      }),
    ]);
    scaled += 1;
    console.log(`  ÷${servings}  ${rec.name.slice(0, 44)}: ${r0(kcal)} → ${r0(kcal * s)} ккал`);
  }

  const dist = await prisma.recipe.aggregate({
    where: { userId: USER_ID, isApproved: true, isNormalized: true },
    _avg: { totalKcal: true },
    _max: { totalKcal: true },
    _count: true,
  });
  const high = await prisma.recipe.count({
    where: { userId: USER_ID, isApproved: true, isNormalized: true, totalKcal: { gt: 1000 } },
  });
  console.log(`\n📊 отмасштабировано: ${scaled}. Пул ${dist._count}, ср.ккал ${r0(Number(dist._avg.totalKcal ?? 0))}, макс ${r0(Number(dist._max.totalKcal ?? 0))}, осталось >1000: ${high}`);
}

main()
  .catch((e) => {
    console.error('normalize-portions failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
