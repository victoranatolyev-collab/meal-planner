import { PrismaClient, type IngredientSource } from '@prisma/client';

/**
 * Идемпотентный демо-сид (для dev/демо/деплоя).
 * Запуск: `DATABASE_URL=... npm run seed --workspace core`
 *
 * Создаёт демо-пользователя с полным набором данных, чтобы все разделы UI были живыми:
 * ингредиенты (с ценами и магазином) → рецепты с составом → цели КБЖУ → тег-правила →
 * остатки (stock) → дневник. План недели генерируется отдельно (нужен llm-service) — см. README.
 */
const prisma = new PrismaClient();

const USER_ID = 'dec00000-0000-0000-0000-000000000001';

interface IngSeed {
  id: string;
  name: string;
  source: IngredientSource;
  kcal: number;
  p: number;
  f: number;
  c: number;
  price: number; // ₽ / 100 г
  tags?: string[]; // бан-теги §13a и пр. (см. ban-keywords.ts)
}

const INGREDIENTS: IngSeed[] = [
  { id: 'ing00000-0000-0000-0000-000000000001', name: 'Овсяные хлопья', source: 'FIVEKA', kcal: 370, p: 13, f: 7, c: 62, price: 8 },
  { id: 'ing00000-0000-0000-0000-000000000002', name: 'Банан', source: 'FIVEKA', kcal: 95, p: 1.5, f: 0.2, c: 21, price: 12 },
  { id: 'ing00000-0000-0000-0000-000000000003', name: 'Арахисовая паста', source: 'LL', kcal: 600, p: 25, f: 50, c: 20, price: 60 },
  { id: 'ing00000-0000-0000-0000-000000000004', name: 'Куриная грудка', source: 'FIVEKA', kcal: 165, p: 31, f: 3.6, c: 0, price: 45 },
  { id: 'ing00000-0000-0000-0000-000000000005', name: 'Гречка', source: 'FIVEKA', kcal: 343, p: 13, f: 3.4, c: 72, price: 12, tags: ['гречка'] },
  { id: 'ing00000-0000-0000-0000-000000000006', name: 'Лосось', source: 'VV', kcal: 208, p: 20, f: 13, c: 0, price: 120 },
  { id: 'ing00000-0000-0000-0000-000000000007', name: 'Киноа', source: 'LL', kcal: 368, p: 14, f: 6, c: 64, price: 70 },
  { id: 'ing00000-0000-0000-0000-000000000008', name: 'Брокколи', source: 'FIVEKA', kcal: 34, p: 2.8, f: 0.4, c: 7, price: 30 },
  { id: 'ing00000-0000-0000-0000-000000000009', name: 'Творог 5%', source: 'FIVEKA', kcal: 121, p: 16, f: 5, c: 3, price: 25 },
  { id: 'ing00000-0000-0000-0000-000000000010', name: 'Грецкий орех', source: 'TSEH', kcal: 654, p: 15, f: 65, c: 14, price: 90 },
  { id: 'ing00000-0000-0000-0000-000000000011', name: 'Мёд', source: 'TSEH', kcal: 304, p: 0.3, f: 0, c: 82, price: 50 },
  { id: 'ing00000-0000-0000-0000-000000000012', name: 'Фета', source: 'VV', kcal: 264, p: 14, f: 21, c: 4, price: 80 },
  { id: 'ing00000-0000-0000-0000-000000000013', name: 'Огурец', source: 'FIVEKA', kcal: 15, p: 0.8, f: 0.1, c: 3.6, price: 20 },
  { id: 'ing00000-0000-0000-0000-000000000014', name: 'Помидор', source: 'FIVEKA', kcal: 18, p: 0.9, f: 0.2, c: 3.9, price: 25 },
  { id: 'ing00000-0000-0000-0000-000000000015', name: 'Оливковое масло', source: 'LL', kcal: 884, p: 0, f: 100, c: 0, price: 40 },
];

// recipeId → [ingredientId, qtyG]
const RECIPE_INGREDIENTS: Record<string, Array<[string, number]>> = {
  'dec0re01-0000-0000-0000-000000000001': [
    ['ing00000-0000-0000-0000-000000000001', 60],
    ['ing00000-0000-0000-0000-000000000002', 120],
    ['ing00000-0000-0000-0000-000000000003', 20],
  ],
  'dec0re02-0000-0000-0000-000000000002': [
    ['ing00000-0000-0000-0000-000000000004', 180],
    ['ing00000-0000-0000-0000-000000000005', 70],
    ['ing00000-0000-0000-0000-000000000008', 100],
  ],
  'dec0re03-0000-0000-0000-000000000003': [
    ['ing00000-0000-0000-0000-000000000006', 150],
    ['ing00000-0000-0000-0000-000000000007', 70],
    ['ing00000-0000-0000-0000-000000000008', 120],
  ],
  'dec0re04-0000-0000-0000-000000000004': [
    ['ing00000-0000-0000-0000-000000000009', 200],
    ['ing00000-0000-0000-0000-000000000010', 20],
    ['ing00000-0000-0000-0000-000000000011', 15],
  ],
  'dec0re05-0000-0000-0000-000000000005': [
    ['ing00000-0000-0000-0000-000000000013', 100],
    ['ing00000-0000-0000-0000-000000000014', 120],
    ['ing00000-0000-0000-0000-000000000012', 50],
    ['ing00000-0000-0000-0000-000000000015', 10],
  ],
};

// Базовые остатки (stock) демо-юзера: ingredientId → qtyG.
const STOCK: Array<[string, number]> = [
  ['ing00000-0000-0000-0000-000000000001', 500],
  ['ing00000-0000-0000-0000-000000000005', 800],
  ['ing00000-0000-0000-0000-000000000004', 600],
  ['ing00000-0000-0000-0000-000000000009', 400],
];

async function main() {
  // 1. Пользователь (backdated → "текущий" в single-user dev).
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: { id: USER_ID, email: 'demo@meal.local', createdAt: new Date('2020-01-01T00:00:00Z') },
    update: {},
  });

  // 2. Ингредиенты.
  for (const ing of INGREDIENTS) {
    await prisma.ingredient.upsert({
      where: { id: ing.id },
      create: {
        id: ing.id,
        name: ing.name,
        source: ing.source,
        kcal100g: ing.kcal,
        protein100g: ing.p,
        fat100g: ing.f,
        carbs100g: ing.c,
        pricePer100g: ing.price,
        unit: 'g',
        tags: ing.tags ?? [],
      },
      update: { pricePer100g: ing.price, source: ing.source, tags: ing.tags ?? [] },
    });
  }

  // 3. Рецепты (уже нормализованные) + состав.
  // dec0re02 содержит гречку → §13a-нарушитель: сидим его сразу демотированным,
  // иначе reseed возвращал бы запрещённый продукт в одобренный пул. См. ban-keywords.ts.
  const GRECHKA_REASON =
    'BAN_TAG(гречка): ингредиент «Гречка» подпадает под бан — §13a: гречка исключена (замена рис/макароны/картофель)';
  const recipes: Array<{
    id: string;
    name: string;
    instr: string;
    kcal: number;
    p: number;
    f: number;
    c: number;
    approved?: boolean;
    rejectionReasons?: string[];
  }> = [
    { id: 'dec0re01-0000-0000-0000-000000000001', name: 'Овсянка с бананом и арахисовой пастой', instr: 'Сварить овсянку, добавить банан и арахисовую пасту.', kcal: 520, p: 18, f: 16, c: 78 },
    { id: 'dec0re02-0000-0000-0000-000000000002', name: 'Куриная грудка с гречкой и овощами', instr: 'Отварить гречку, обжарить грудку, подать с овощами.', kcal: 610, p: 52, f: 14, c: 62, approved: false, rejectionReasons: [GRECHKA_REASON] },
    { id: 'dec0re03-0000-0000-0000-000000000003', name: 'Лосось с киноа и брокколи', instr: 'Запечь лосось, отварить киноа и брокколи.', kcal: 580, p: 42, f: 24, c: 45 },
    { id: 'dec0re04-0000-0000-0000-000000000004', name: 'Творог с орехами и мёдом', instr: 'Смешать творог с орехами и мёдом.', kcal: 340, p: 30, f: 14, c: 22 },
    { id: 'dec0re05-0000-0000-0000-000000000005', name: 'Греческий салат с фетой', instr: 'Нарезать овощи, добавить фету и оливковое масло.', kcal: 280, p: 11, f: 22, c: 12 },
  ];
  for (const r of recipes) {
    const approved = r.approved ?? true;
    const rejectionReasons = r.rejectionReasons ?? [];
    await prisma.recipe.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        userId: USER_ID,
        name: r.name,
        instructions: r.instr,
        isRelevant: true,
        isNormalized: true,
        isApproved: approved,
        rejectionReasons,
        totalKcal: r.kcal,
        totalProteinG: r.p,
        totalFatG: r.f,
        totalCarbsG: r.c,
        source: 'MANUAL',
      },
      update: { isApproved: approved, isNormalized: true, rejectionReasons },
    });
    // Состав — пересоздаём идемпотентно.
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: r.id } });
    await prisma.recipeIngredient.createMany({
      data: (RECIPE_INGREDIENTS[r.id] ?? []).map(([ingredientId, qtyG]) => ({
        recipeId: r.id,
        ingredientId,
        qtyG,
      })),
    });
  }

  // 4. Цели КБЖУ. Согласованы с моделью calcNorms (белок 1.8 г/кг, жир 0.8 г/кг, углеводы — остаток):
  // 86 кг → TDEE ≈ 2572 ккал · Б 155 · Ж 69 · У 333 (maintenance).
  await prisma.nutritionTarget.upsert({
    where: { userId: USER_ID },
    create: {
      userId: USER_ID,
      kcalPerDay: 2572,
      proteinGPerDay: 155,
      fatGPerDay: 69,
      carbsGPerDay: 333,
      proteinGPerKgMin: 1.8,
      budgetTargetRubPerWeek: 5000,
      budgetSoftCapRubPerWeek: 6000,
    },
    update: {
      kcalPerDay: 2572,
      proteinGPerDay: 155,
      fatGPerDay: 69,
      carbsGPerDay: 333,
      proteinGPerKgMin: 1.8,
    },
  });

  // 5. Тег-правила (идемпотентно: чистим и пересоздаём для демо-юзера).
  await prisma.tagRule.deleteMany({ where: { userId: USER_ID } });
  await prisma.tagRule.createMany({
    data: [
      { userId: USER_ID, ruleKind: 'BAN_TAG', tagName: 'свинина', reason: 'Не употребляю свинину' },
      // §13a (menu_rules.md): жёстко исключённые продукты. Ловятся через ban-keywords.ts
      // (тег + синонимы + ключевые слова в названии ингредиента и рецепта).
      { userId: USER_ID, ruleKind: 'BAN_TAG', tagName: 'чеснок', reason: '§13a: чеснок исключён из домашних рецептов' },
      { userId: USER_ID, ruleKind: 'BAN_TAG', tagName: 'гречка', reason: '§13a: гречка исключена (замена рис/макароны/картофель)' },
      { userId: USER_ID, ruleKind: 'BAN_TAG', tagName: 'майонез', reason: '§13a/§8: майонез исключён' },
      { userId: USER_ID, ruleKind: 'BAN_TAG', tagName: 'whey', reason: '§13a: whey-протеин исключён' },
      { userId: USER_ID, ruleKind: 'MIN_PER_WEEK', tagName: 'железо', quantity: 3, reason: 'Профилактика анемии' },
      { userId: USER_ID, ruleKind: 'REQUIRE_TAG_IN_MEAL', tagName: 'белок', mealTag: 'post_workout', reason: 'Белок после тренировки' },
    ],
  });

  // 5b. Антропометрия (вход scr-calc-norms — иначе агент-tool calc_norms падает «нет данных»).
  // Append-only модель: фиксированный id + upsert ради идемпотентности сида.
  await prisma.anthropometry.upsert({
    where: { id: 'dec0a000-0000-0000-0000-000000000001' },
    create: {
      id: 'dec0a000-0000-0000-0000-000000000001',
      userId: USER_ID,
      sex: 'MALE',
      ageYears: 24,
      heightCm: 190,
      weightKg: 86,
      bodyFatPercent: 11,
      // Модель активности doctorushakov (вместо грубого activityLevel): шаги + силовые/нед + кардио/нед.
      stepsPerDay: 7000,
      strengthMinutesPerWeek: 180,
      cardioMinutesPerWeek: 0,
      goal: 'MAINTAIN',
      measuredAt: new Date('2026-05-25T00:00:00Z'),
    },
    update: {
      ageYears: 24,
      heightCm: 190,
      stepsPerDay: 7000,
      strengthMinutesPerWeek: 180,
      cardioMinutesPerWeek: 0,
      activityLevel: null,
    },
  });

  // 6. Остатки (stock baseline).
  for (const [ingredientId, qtyG] of STOCK) {
    await prisma.stockItem.upsert({
      where: { uniq_user_ingredient: { userId: USER_ID, ingredientId } },
      create: { userId: USER_ID, ingredientId, qtyG },
      update: { qtyG },
    });
  }

  // 7. Дневник (идемпотентно: чистим и создаём пару записей за последние дни).
  await prisma.foodDiaryEntry.deleteMany({ where: { userId: USER_ID } });
  await prisma.foodDiaryEntry.createMany({
    data: [
      { userId: USER_ID, recipeId: 'dec0re01-0000-0000-0000-000000000001', portionFactor: 1, kcal: 520, proteinG: 18, fatG: 16, carbsG: 78, mealName: 'Завтрак', eatenAt: new Date('2026-05-28T08:30:00Z') },
      { userId: USER_ID, recipeId: 'dec0re02-0000-0000-0000-000000000002', portionFactor: 1.5, kcal: 915, proteinG: 78, fatG: 21, carbsG: 93, mealName: 'Обед', eatenAt: new Date('2026-05-28T14:00:00Z') },
      { userId: USER_ID, customName: 'Протеиновый батончик', portionFactor: 1, kcal: 200, proteinG: 20, fatG: 7, carbsG: 18, mealName: 'Перекус', eatenAt: new Date('2026-05-28T17:00:00Z') },
    ],
  });

  const counts = {
    anthropometry: await prisma.anthropometry.count({ where: { userId: USER_ID } }),
    ingredients: await prisma.ingredient.count(),
    recipes: await prisma.recipe.count({ where: { userId: USER_ID, isApproved: true } }),
    stock: await prisma.stockItem.count({ where: { userId: USER_ID } }),
    diary: await prisma.foodDiaryEntry.count({ where: { userId: USER_ID } }),
    tagRules: await prisma.tagRule.count({ where: { userId: USER_ID } }),
  };
  console.log('✅ seed complete:', JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error('seed failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
