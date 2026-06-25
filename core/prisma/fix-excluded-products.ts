import { prisma } from '../src/db.js';
import { validateRecipe } from '../src/validation/index.js';
import { BAN_TAGS, deriveBanTags } from '../src/validation/ban-keywords.js';

/**
 * Идемпотентный фикс утечки §13a (menu_rules.md): чеснок / гречка / майонез / whey
 * просочились в одобренный пул рецептов.
 *
 * Запуск:
 *   DATABASE_URL=postgresql://meal:meal@localhost:5432/meal_planner \
 *     npx tsx prisma/fix-excluded-products.ts
 *
 * Что делает (всё идемпотентно — можно гонять повторно):
 *   1. tag_dictionary: заводит канонические бан-теги §13a.
 *   2. tag_rules: добавляет BAN_TAG-правила (чеснок/гречка/майонез/whey) для пользователя.
 *   3. ingredients.tags[]: бэкафилл — проставляет бан-теги по названию/синонимам.
 *   4. Прогоняет РЕАЛЬНЫЙ validateRecipe по текущему одобренному+нормализованному пулу —
 *      нарушители демотируются (is_approved=false) через сам пайплайн, чистые остаются.
 *
 * См. docs/HISTORY.md 2026-05-31.
 */
const USER_ID = 'dec00000-0000-0000-0000-000000000001';

const DICTIONARY: Array<{ name: string; description: string }> = [
  { name: 'чеснок', description: '§13a: исключён из всех домашних рецептов/маринадов/соусов' },
  { name: 'гречка', description: '§13a / nutrition_norms: исключена, замена рис/макароны/картофель' },
  { name: 'майонез', description: '§13a / §8: майонез и майонезные соусы исключены' },
  { name: 'whey', description: '§13a: whey-протеин исключён по запросу пользователя' },
];

const BAN_REASON: Record<string, string> = {
  чеснок: '§13a: чеснок исключён из домашних рецептов',
  гречка: '§13a: гречка исключена (замена рис/макароны/картофель)',
  майонез: '§13a/§8: майонез исключён',
  whey: '§13a: whey-протеин исключён',
};

async function ensureDictionary(): Promise<number> {
  let added = 0;
  for (const { name, description } of DICTIONARY) {
    const res = await prisma.tag.upsert({
      where: { name },
      create: { name, category: 'CATEGORY', description, isSystem: true },
      update: { description },
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) added += 1;
  }
  return added;
}

async function ensureRules(): Promise<number> {
  let created = 0;
  for (const tag of BAN_TAGS) {
    const exists = await prisma.tagRule.findFirst({
      where: { userId: USER_ID, ruleKind: 'BAN_TAG', tagName: tag },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.tagRule.create({
      data: { userId: USER_ID, ruleKind: 'BAN_TAG', tagName: tag, reason: BAN_REASON[tag] },
    });
    created += 1;
  }
  return created;
}

async function backfillIngredientTags(): Promise<number> {
  const ingredients = await prisma.ingredient.findMany({ select: { id: true, name: true, tags: true } });
  let updated = 0;
  for (const ing of ingredients) {
    const need = deriveBanTags({ id: ing.id, name: ing.name, tags: ing.tags });
    const missing = need.filter((t) => !ing.tags.includes(t));
    if (missing.length === 0) continue;
    await prisma.ingredient.update({
      where: { id: ing.id },
      data: { tags: [...ing.tags, ...missing] },
    });
    updated += 1;
  }
  return updated;
}

async function revalidatePool() {
  const pool = await prisma.recipe.findMany({
    where: { userId: USER_ID, isApproved: true, isNormalized: true },
    select: { id: true, name: true },
  });

  const demoted: Array<{ id: string; name: string; reasons: string[] }> = [];
  for (const r of pool) {
    const res = await validateRecipe(r.id);
    if (!res.isApproved) demoted.push({ id: r.id, name: r.name, reasons: res.rejectionReasons });
  }
  return { poolSize: pool.length, demoted };
}

function countByCategory(demoted: Array<{ reasons: string[] }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tag of BAN_TAGS) {
    counts[tag] = demoted.filter((d) => d.reasons.some((x) => x.includes(`BAN_TAG(${tag})`))).length;
  }
  return counts;
}

async function main() {
  console.log('=== fix-excluded-products (§13a) ===');

  const dictAdded = await ensureDictionary();
  console.log(`1. tag_dictionary: +${dictAdded} новых тегов (всего обеспечено ${DICTIONARY.length})`);

  const rulesAdded = await ensureRules();
  console.log(`2. tag_rules BAN_TAG: +${rulesAdded} новых (всего обеспечено ${BAN_TAGS.length}: ${BAN_TAGS.join(', ')})`);

  const tagsBackfilled = await backfillIngredientTags();
  console.log(`3. ingredients.tags[]: протегировано ${tagsBackfilled} ингредиентов`);

  const { poolSize, demoted } = await revalidatePool();
  console.log(`4. revalidate: проверено ${poolSize} рецептов пула, демотировано ${demoted.length}`);

  const byCat = countByCategory(demoted);
  console.log('   по категориям:', JSON.stringify(byCat));
  for (const d of demoted) {
    console.log(`   ✗ ${d.name}`);
    for (const reason of d.reasons) console.log(`        ${reason}`);
  }

  const stillBad = await prisma.recipe.count({
    where: {
      userId: USER_ID,
      isApproved: true,
      isNormalized: true,
      OR: [
        { name: { contains: 'чеснок', mode: 'insensitive' } },
        { name: { contains: 'гречк', mode: 'insensitive' } },
        { ingredients: { some: { ingredient: { tags: { hasSome: ['чеснок', 'гречка', 'майонез', 'whey'] } } } } },
      ],
    },
  });
  console.log(`5. контроль: одобренных рецептов с бан-тегами/именами осталось = ${stillBad}`);
}

main()
  .catch((e) => {
    console.error('fix-excluded-products failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
