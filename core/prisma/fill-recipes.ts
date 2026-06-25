import { PrismaClient } from '@prisma/client';
import { searchRecipes, normalizeRecipe, validateRecipe } from '../src/index.js';

/**
 * Массовая набивка пула блюд через полный пайплайн (search → normalize → validate)
 * до целевого размера. Темы варьируются для разнообразия.
 * Запуск: DATABASE_URL=... npx tsx prisma/fill-recipes.ts [target=100] [perBatch=12]
 */
const prisma = new PrismaClient();
const USER_ID = 'dec00000-0000-0000-0000-000000000001';

const THEMES = [
  'белковые завтраки (яйца, творог, овсянка)',
  'сытные обеды с курицей и крупами',
  'рыбные ужины (лосось, скумбрия, треска) с овощами',
  'вегетарианские блюда из бобовых и овощей',
  'супы (щи, борщ, куриный, овощной)',
  'салаты свежие с заправками',
  'блюда с говядиной и печенью (источники железа)',
  'паста и блюда из риса/гречки',
  'перекусы и белковые десерты (творог, йогурт, орехи)',
  'запеканки и блюда из духовки',
  'азиатские блюда (курица терияки, рис, овощи)',
  'омлеты, сырники и блюда из яиц',
];

const poolSize = () =>
  prisma.recipe.count({ where: { userId: USER_ID, isApproved: true, isNormalized: true } });

async function main() {
  const target = Number(process.argv[2] ?? 100);
  const perBatch = Number(process.argv[3] ?? 12);

  let pool = await poolSize();
  console.log(`старт. в пуле: ${pool}, цель: ${target}\n`);

  for (let t = 0; t < THEMES.length && pool < target; t += 1) {
    const theme = THEMES[t]!;
    try {
      const res = await searchRecipes({ userId: USER_ID, count: perBatch, notes: theme });
      let approved = 0, matchedTot = 0, rawTot = 0;
      for (const r of res.created) {
        try {
          const norm = await normalizeRecipe(r.id);
          const val = await validateRecipe(r.id);
          matchedTot += norm.matched.length;
          rawTot += norm.matched.length + norm.unmatched.length;
          if (val.isApproved) approved += 1;
        } catch (e) {
          console.warn(`   ⚠ ${r.name}: ${(e as Error).message}`);
        }
      }
      pool = await poolSize();
      const rate = rawTot ? Math.round((matchedTot / rawTot) * 100) : 0;
      console.log(
        `[${t + 1}/${THEMES.length}] «${theme}»: +${approved}/${res.count} одобрено · привязка ${rate}% (${matchedTot}/${rawTot}) · пул=${pool}`,
      );
    } catch (e) {
      console.warn(`[${t + 1}] тема «${theme}» — ошибка батча: ${(e as Error).message}`);
    }
  }

  console.log(`\n📊 итог: в пуле ${pool} блюд (цель ${target}).`);
}

main()
  .catch((e) => {
    console.error('fill failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
