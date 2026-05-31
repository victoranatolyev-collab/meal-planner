import { readFileSync } from 'node:fs';
import { PrismaClient, type IngredientSource } from '@prisma/client';

/**
 * Одноразовый импорт реальной библиотеки блюд пользователя в пул рецептов.
 * Источники (data/): dishes_library.json (шаблоны блюд + теги), custom_ingredients.json
 * (local:* ингредиенты с КБЖУ), ingredients_spb.json (plu:* — КБЖУ + цены Пятёрочки).
 *
 * Запуск: DATABASE_URL=... npx tsx prisma/import-dishes.ts
 *
 * Идемпотентно: ингредиенты дедуплицируются по externalCode (ref), рецепты — по (userId, name)
 * с пересозданием состава/тегов. После импорта демо-рецепты (не из этого списка) выводятся
 * из пула (isApproved=false), чтобы план собирался ТОЛЬКО из реальных блюд.
 */
const prisma = new PrismaClient();
const USER_ID = 'dec00000-0000-0000-0000-000000000001';
const DATA = '/Users/victor_mac/Питание/App/data';

const dishesLib = JSON.parse(readFileSync(`${DATA}/dishes_library.json`, 'utf-8')) as {
  dishes: Record<string, DishTpl>;
};
const customIng = JSON.parse(readFileSync(`${DATA}/custom_ingredients.json`, 'utf-8')) as {
  ingredients: Record<string, CustomIng>;
};
const spb = JSON.parse(readFileSync(`${DATA}/ingredients_spb.json`, 'utf-8')) as {
  products: Record<string, SpbProduct>;
};

interface DishTpl {
  id: string;
  name: string;
  ingredients: Array<{ ref: string; qty_g?: number; note?: string; fresh_addon?: boolean }>;
  method?: string;
  tags?: string[];
}
interface CustomIng {
  name: string;
  shop?: string;
  weight_g?: number;
  kcal_per_100g?: number;
  protein_per_100g?: number;
  fat_per_100g?: number;
  carbs_per_100g?: number;
  price_rub?: number;
  unit?: string;
}
interface SpbProduct {
  name: string;
  weight?: { grams?: number };
  prices?: { regular?: number | null; discount?: number | null };
  kbju?: { kcal?: number; protein?: number; fat?: number; carbs?: number };
}

/** Реальные ПРИЁМЫ ПИЩИ для пула планировщика + доп. слот-теги (завтрак/обед/ужин). */
const PICK: Array<{ id: string; slotTags: string[] }> = [
  { id: 'main_a', slotTags: ['обед', 'ужин', 'белок'] },
  { id: 'main_b', slotTags: ['обед', 'ужин'] },
  { id: 'main_c', slotTags: ['обед', 'ужин', 'железо'] },
  { id: 'spring_shawarma', slotTags: ['завтрак'] },
  { id: 'shawarma_bowl_sat', slotTags: ['завтрак'] },
  { id: 'quesadilla_sun', slotTags: ['завтрак'] },
  { id: 'bk_grill_lunch', slotTags: ['обед'] },
  { id: 'ts_15_carry_sandwich', slotTags: ['завтрак'] },
  { id: 'dessert_curd_banana_choc', slotTags: ['ужин', 'десерт'] },
  { id: 'dessert_yogurt_choc_strawberry', slotTags: ['ужин', 'десерт'] },
  { id: 'dessert_curd_banana_choc_large', slotTags: ['ужин', 'десерт'] },
];

function shopToSource(shop?: string): IngredientSource {
  const s = (shop ?? '').toLowerCase();
  if (s.includes('пятёроч') || s.includes('пятероч')) return 'FIVEKA';
  if (s.includes('цех')) return 'TSEH';
  if (s === 'лл' || s.includes('лл')) return 'LL';
  if (s === 'вв') return 'VV';
  return 'CUSTOM';
}

interface Resolved {
  name: string;
  source: IngredientSource;
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
  price100: number;
}

function resolveRef(ref: string): Resolved | null {
  if (ref.startsWith('local:')) {
    const c = customIng.ingredients[ref.slice(6)];
    if (!c) return null;
    let price100 = 0;
    if (c.weight_g && c.weight_g > 0 && c.price_rub) price100 = (c.price_rub / c.weight_g) * 100;
    else if ((c.unit ?? '').toLowerCase().includes('кг') && c.price_rub) price100 = c.price_rub / 10;
    return {
      name: c.name,
      source: shopToSource(c.shop),
      kcal100: c.kcal_per_100g ?? 0,
      protein100: c.protein_per_100g ?? 0,
      fat100: c.fat_per_100g ?? 0,
      carbs100: c.carbs_per_100g ?? 0,
      price100,
    };
  }
  if (ref.startsWith('plu:')) {
    const p = spb.products[ref.slice(4)];
    if (!p) return null;
    const grams = p.weight?.grams ?? 0;
    const reg = p.prices?.regular ?? 0;
    return {
      name: p.name,
      source: 'FIVEKA',
      kcal100: p.kbju?.kcal ?? 0,
      protein100: p.kbju?.protein ?? 0,
      fat100: p.kbju?.fat ?? 0,
      carbs100: p.kbju?.carbs ?? 0,
      price100: grams > 0 && reg ? (reg / grams) * 100 : 0,
    };
  }
  return null;
}

const ingCache = new Map<string, string>(); // ref → ingredientId

async function ensureIngredient(ref: string, r: Resolved): Promise<string> {
  if (ingCache.has(ref)) return ingCache.get(ref)!;
  const existing = await prisma.ingredient.findFirst({ where: { externalCode: ref } });
  const data = {
    name: r.name,
    source: r.source,
    externalCode: ref,
    kcal100g: round2(r.kcal100),
    protein100g: round2(r.protein100),
    fat100g: round2(r.fat100),
    carbs100g: round2(r.carbs100),
    pricePer100g: round2(r.price100),
    unit: 'g',
  };
  const id = existing
    ? (await prisma.ingredient.update({ where: { id: existing.id }, data })).id
    : (await prisma.ingredient.create({ data })).id;
  ingCache.set(ref, id);
  return id;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

async function main() {
  const importedNames: string[] = [];
  let unresolved = 0;

  for (const pick of PICK) {
    const dish = dishesLib.dishes[pick.id];
    if (!dish) {
      console.warn(`⚠ dish not found: ${pick.id}`);
      continue;
    }

    // Резолвим состав + считаем КБЖУ порции.
    const lines: Array<{ ingredientId: string; qtyG: number; freshAddon: boolean; note?: string }> = [];
    let kcal = 0, protein = 0, fat = 0, carbs = 0;
    for (const ing of dish.ingredients) {
      const qty = ing.qty_g ?? 0;
      if (qty <= 0) continue;
      const r = resolveRef(ing.ref);
      if (!r) {
        console.warn(`  ⚠ unresolved ref ${ing.ref} in ${pick.id}`);
        unresolved += 1;
        continue;
      }
      const factor = qty / 100;
      kcal += r.kcal100 * factor;
      protein += r.protein100 * factor;
      fat += r.fat100 * factor;
      carbs += r.carbs100 * factor;
      const ingredientId = await ensureIngredient(ing.ref, r);
      lines.push({ ingredientId, qtyG: Math.round(qty), freshAddon: !!ing.fresh_addon, ...(ing.note ? { note: ing.note } : {}) });
    }

    const tags = [...new Set([...(dish.tags ?? []), ...pick.slotTags])];

    // Дедуп по (userId, name): пересоздаём.
    const existing = await prisma.recipe.findFirst({ where: { userId: USER_ID, name: dish.name } });
    const recipeData = {
      userId: USER_ID,
      name: dish.name,
      instructions: dish.method ?? '',
      isRelevant: true,
      isNormalized: true,
      isApproved: true,
      totalKcal: round2(kcal),
      totalProteinG: round2(protein),
      totalFatG: round2(fat),
      totalCarbsG: round2(carbs),
      source: 'IMPORTED' as const,
    };
    let recipeId: string;
    if (existing) {
      await prisma.recipe.update({ where: { id: existing.id }, data: recipeData });
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: existing.id } });
      await prisma.recipeTag.deleteMany({ where: { recipeId: existing.id } });
      recipeId = existing.id;
    } else {
      recipeId = (await prisma.recipe.create({ data: recipeData })).id;
    }
    if (lines.length) await prisma.recipeIngredient.createMany({ data: lines.map((l) => ({ recipeId, ...l })) });
    if (tags.length) await prisma.recipeTag.createMany({ data: tags.map((t) => ({ recipeId, tagName: t })), skipDuplicates: true });

    importedNames.push(dish.name);
    console.log(`✅ ${dish.name}  →  ${Math.round(kcal)} ккал, Б${Math.round(protein)} Ж${Math.round(fat)} У${Math.round(carbs)}  [${tags.join(', ')}]`);
  }

  // Демо-рецепты (и любые прочие не из этого списка) — вывести из пула.
  const demoted = await prisma.recipe.updateMany({
    where: { userId: USER_ID, name: { notIn: importedNames }, isApproved: true },
    data: { isApproved: false },
  });

  console.log(`\n📊 импортировано блюд: ${importedNames.length}, не разрешено refs: ${unresolved}, выведено из пула (демо): ${demoted.count}`);
}

main()
  .catch((e) => {
    console.error('import failed:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
