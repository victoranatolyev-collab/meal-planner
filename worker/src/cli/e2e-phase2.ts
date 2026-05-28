#!/usr/bin/env tsx
// E2E acceptance Phase 2: правило → рецепт → нормализация → валидация (через core-сервисы).
//
// Закрывает acceptance-критерий Phase 2 из docs/PLAN.md.
// Прогоняет весь пайплайн рецептов в одной цепочке:
//   scr-search-recipes → scr-normalize-recipe → scr-validate-recipes (+ ent-nutrition-rules).
//
// Предусловия (поднять до запуска):
//   docker compose up -d postgres && npm run prisma:migrate:deploy --workspace core
//   LLM_MODE=stub PORT=3001 npx tsx llm-service/src/index.ts   (для searchRecipes)
// Запуск:
//   DATABASE_URL=... LLM_SERVICE_URL=http://localhost:3001 npm run e2e:phase2 --workspace worker
//
// Exit 0 — все проверки прошли; exit 1 — провал.

import { prisma, searchRecipes, normalizeRecipe, validateRecipe, createTagRule } from 'core';

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log('  ✓', msg);
  } else {
    console.error('  ✗ FAIL:', msg);
    failures += 1;
  }
}

const log = (...a: unknown[]): void => console.log('[e2e-phase2]', ...a);

// Каталожные ингредиенты с тегами (source=CUSTOM, чтобы не конфликтовать с парсерами).
const INGREDIENTS = [
  { name: 'Чеснок свежий', tags: ['garlic', 'vegetable'], kcal: 143, p: 6.5, f: 0.5, c: 30 },
  { name: 'Куриное филе охлаждённое', tags: ['chicken', 'protein', 'meat'], kcal: 113, p: 24, f: 1.9, c: 0 },
  { name: 'Гречка ядрица', tags: ['grain', 'iron'], kcal: 343, p: 13, f: 3.4, c: 62 },
];

log('starting…');

// 1. Чистый пользователь.
const user = await prisma.user.upsert({
  where: { email: 'e2e-phase2@example.com' },
  update: {},
  create: { email: 'e2e-phase2@example.com' },
});
// Порядок важен: сначала рецепты (cascade снимет recipe_ingredients), потом правила.
await prisma.recipe.deleteMany({ where: { userId: user.id } });
await prisma.tagRule.deleteMany({ where: { userId: user.id } });

// 2. Каталог с тегами (идемпотентный upsert по (name, source, pack_size)).
for (const i of INGREDIENTS) {
  await prisma.ingredient.upsert({
    where: { uniq_name_source_pack: { name: i.name, source: 'CUSTOM', packSize: 'e2e' } },
    update: { tags: i.tags, kcal100g: i.kcal, protein100g: i.p, fat100g: i.f, carbs100g: i.c },
    create: {
      name: i.name,
      source: 'CUSTOM',
      packSize: 'e2e',
      unit: 'g',
      tags: i.tags,
      kcal100g: i.kcal,
      protein100g: i.p,
      fat100g: i.f,
      carbs100g: i.c,
    },
  });
}
log('catalog seeded:', INGREDIENTS.length, 'ingredients with tags');

// 3. Правило: запрет чеснока (ent-nutrition-rules / tag_rules).
await createTagRule({
  userId: user.id,
  ruleKind: 'BAN_TAG',
  tagName: 'garlic',
  reason: 'e2e: запрет чеснока (§13a)',
  isActive: true,
});
log('rule seeded: BAN_TAG garlic');

// 4. scr-search-recipes (stub) — LLM генерит рецепты, persist is_relevant=true.
console.log('\n[1/4] scr-search-recipes (через llm-service stub)');
let searchOk = false;
try {
  const search = await searchRecipes({ userId: user.id, count: 2 });
  check(search.count >= 1, `searchRecipes создал ${search.count} рецепт(а) с is_relevant=true`);
  searchOk = search.count >= 1;
} catch (err) {
  console.error('  ✗ FAIL: searchRecipes бросил ошибку (поднят ли llm-service на :3001?):',
    err instanceof Error ? err.message : err);
  failures += 1;
}

// 5. Контролируемые рецепты с raw-ингредиентами (детерминированно).
const bannedRecipe = await prisma.recipe.create({
  data: {
    userId: user.id,
    name: 'E2E: блюдо с чесноком',
    source: 'MANUAL',
    isRelevant: true,
    rawIngredients: [
      { name: 'чеснок', qty: 20, unit: 'г' },
      { name: 'куриное филе', qty: 200, unit: 'г' },
    ],
  },
});
const cleanRecipe = await prisma.recipe.create({
  data: {
    userId: user.id,
    name: 'E2E: чистое блюдо',
    source: 'MANUAL',
    isRelevant: true,
    rawIngredients: [
      { name: 'куриное филе', qty: 200, unit: 'г' },
      { name: 'гречка', qty: 80, unit: 'г' },
    ],
  },
});

// 6. scr-normalize-recipe — fuzzy-match raw → каталог.
console.log('\n[2/4] scr-normalize-recipe (pg_trgm fuzzy-match)');
const normBanned = await normalizeRecipe(bannedRecipe.id);
const normClean = await normalizeRecipe(cleanRecipe.id);
check(
  normBanned.matched.some((m) => m.matchedName.toLowerCase().includes('чеснок')),
  `«чеснок» сматчился на каталог (${normBanned.matched.map((m) => m.matchedName).join(', ') || '—'})`,
);
check(normClean.matched.length >= 1, `чистый рецепт сматчил ${normClean.matched.length} ингр.`);

// 7. scr-validate-recipes — против tag_rules.
console.log('\n[3/4] scr-validate-recipes (tag-based rule engine)');
const valBanned = await validateRecipe(bannedRecipe.id);
const valClean = await validateRecipe(cleanRecipe.id);
check(valBanned.isApproved === false, 'рецепт с чесноком ОТКЛОНЁН (is_approved=false)');
check(
  valBanned.rejectionReasons.some((r) => /garlic|чеснок/i.test(r)),
  `причина отказа упоминает garlic/чеснок: "${valBanned.rejectionReasons[0] ?? '—'}"`,
);
check(valClean.isApproved === true, 'чистый рецепт ОДОБРЕН (is_approved=true)');

// 8. Проверка персистентности флагов.
console.log('\n[4/4] persistence');
const bannedRow = await prisma.recipe.findUniqueOrThrow({ where: { id: bannedRecipe.id } });
check(
  bannedRow.isNormalized && bannedRow.isApproved === false && bannedRow.rejectionReasons.length > 0,
  'флаги в БД: is_normalized=true, is_approved=false, rejection_reasons непустой',
);

console.log('');
const passed = failures === 0 && searchOk;
if (passed) {
  log('✅ E2E PASSED — все 4 этапа пайплайна Phase 2 работают (search → normalize → validate)');
  process.exit(0);
} else {
  log(`❌ E2E FAILED — failures=${failures}, searchOk=${searchOk}`);
  process.exit(1);
}
