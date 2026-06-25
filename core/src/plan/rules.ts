/**
 * Блок правил распределения и подбора блюд на неделю.
 *
 * Источник правды — личные нормы пользователя:
 *   data/nutrition_norms.json (§meal_timing_and_distribution) и data/menu_rules.md (§3, §7, §9).
 * Здесь — машинное представление этих правил, которое потребляет greedy-композер (greedy.ts).
 *
 * Две части:
 *   A. Распределение (distributionFor) — раскладка дня на 4 приёма с пер-приёмными КБЖУ.
 *      Завтрак — самый калорийный приём (880 ккал), не обед. Тренировочные дни (пн/чт):
 *      обед = post-workout (углеводный акцент, низкий жир), завтрак с тегом training_day.
 *   B. Подбор (scoreRecipe + квоты) — какой рецепт ставить в слот:
 *      слот-аффинити по тегам, добор недельных квот (железо≥3, говядина/печень/рыба ≥1),
 *      макро-пригодность (порция в разумном масштабе, белок не проседает), анти-повтор.
 */

export interface MacroTargets {
  kcalPerDay: number;
  proteinGPerDay: number;
  fatGPerDay: number;
  carbsGPerDay: number;
}

/** Целевой приём: абсолютные КБЖУ (уже отмасштабированы под дневную цель пользователя) + теги слота. */
export interface SlotTarget {
  name: string;
  time: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  slotTags: string[];
  dessert: boolean;
  maxPF: number;
}

// --- Базовая раскладка из norms §9 (на референсные 2455 ккал / 161 Б / 90 Ж / 250 У). ---
const NORM_DAY = { kcal: 2455, p: 161, f: 90, c: 250 };

interface RawSlot {
  name: string;
  time: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  tags: string[];
  dessert?: boolean;
}

/** Не-тренировочный день (Вт/Ср/Пт/Сб/Вс) — menu_rules §9.1. */
const SLOTS_REST: RawSlot[] = [
  { name: 'Завтрак', time: '08:30', kcal: 880, p: 55, f: 30, c: 90, tags: ['завтрак', 'breakfast'] },
  { name: 'Обед', time: '13:00', kcal: 580, p: 40, f: 22, c: 55, tags: ['обед', 'lunch'] },
  { name: 'Ужин', time: '18:30', kcal: 620, p: 45, f: 22, c: 60, tags: ['ужин', 'dinner'] },
  { name: 'Перекус', time: '21:00', kcal: 375, p: 21, f: 16, c: 45, tags: ['десерт', 'dessert', 'перекус'], dessert: true },
];

/** Тренировочный день (Пн/Чт) — menu_rules §9.2: обед = post-workout (углеводный, низкий жир). */
const SLOTS_TRAIN: RawSlot[] = [
  { name: 'Завтрак', time: '08:30', kcal: 880, p: 55, f: 30, c: 90, tags: ['завтрак', 'breakfast', 'training_day'] },
  { name: 'Обед', time: '14:00', kcal: 580, p: 45, f: 12, c: 75, tags: ['обед', 'lunch', 'post_workout'] },
  { name: 'Ужин', time: '18:30', kcal: 620, p: 45, f: 22, c: 60, tags: ['ужин', 'dinner'] },
  { name: 'Перекус', time: '21:00', kcal: 375, p: 16, f: 26, c: 25, tags: ['десерт', 'dessert', 'перекус'], dessert: true },
];

/**
 * Раскладка дня под цель пользователя. Сохраняет ФОРМУ распределения из norms
 * (завтрак — крупнейший приём, тренировочный обед углеводный), масштабируя каждый
 * макрос пропорционально фактической дневной цели (БД может отличаться от референса 2455).
 */
export function distributionFor(isTraining: boolean, targets: MacroTargets): SlotTarget[] {
  const raw = isTraining ? SLOTS_TRAIN : SLOTS_REST;
  const kK = targets.kcalPerDay / NORM_DAY.kcal;
  const kP = targets.proteinGPerDay / NORM_DAY.p;
  const kF = targets.fatGPerDay / NORM_DAY.f;
  const kC = targets.carbsGPerDay / NORM_DAY.c;
  return raw.map((s) => ({
    name: s.name,
    time: s.time,
    kcal: Math.round(s.kcal * kK),
    proteinG: Math.round(s.p * kP),
    fatG: Math.round(s.f * kF),
    carbsG: Math.round(s.c * kC),
    slotTags: s.tags,
    dessert: !!s.dessert,
    maxPF: s.dessert ? 1.5 : 2.0,
  }));
}

/** Тренировочные дни по умолчанию — Пн (1) и Чт (4), если dayType явно не задан (norms). */
export function isTrainingDay(date: string, dayType?: string): boolean {
  if (dayType) return dayType.toLowerCase().includes('train');
  const wd = new Date(`${date}T00:00:00.000Z`).getUTCDay(); // 0=Вс … 6=Сб
  return wd === 1 || wd === 4;
}

// --- Категории блюд (теги + эвристика по имени, т.к. теги в пуле неоднородны). ---
const RX = {
  beef: /говяд|телятин|бефстроган/i,
  liver: /печ[её]н/i,
  fish: /лосос|с[её]мг|семг|скумбр|треск|форел|тунец|сельд|минтай|горбуш|\bрыб/i,
  chicken: /куриц|курин|курян|грудк|индейк|цыпл/i,
  breakfast: /завтрак|омлет|сырник|овс[яё]н|каш[аи]|запеканк|яичниц|скрамбл|гранол|тост|блин|оладь/i,
  dessert: /десерт|чизкейк|мороженое|творож|пудинг|смузи|йогурт|сырник/i,
};
const TAGS = {
  iron: new Set(['iron', 'железо', 'iron_meal', 'anemia_priority']),
  fish: new Set(['рыба', 'fish', 'лосось', 'скумбрия', 'треска', 'omega3', 'морской', 'seafood']),
  beef: new Set(['говядина', 'beef']),
  liver: new Set(['печень', 'liver']),
  chicken: new Set(['chicken', 'курица', 'индейка', 'poultry']),
  breakfast: new Set(['завтрак', 'breakfast', 'breakfast_weekend', 'breakfast_office', 'омлет', 'сырник']),
  dessert: new Set(['десерт', 'dessert', 'sweet', 'перекус', 'snack', 'evening']),
};

export interface Categorizable {
  name: string;
  mealTags: string[];
}

const hasTag = (r: Categorizable, set: Set<string>): boolean => r.mealTags.some((t) => set.has(t.toLowerCase()));

export const isBeef = (r: Categorizable): boolean => RX.beef.test(r.name) || hasTag(r, TAGS.beef);
export const isLiver = (r: Categorizable): boolean => RX.liver.test(r.name) || hasTag(r, TAGS.liver);
export const isFish = (r: Categorizable): boolean => RX.fish.test(r.name) || hasTag(r, TAGS.fish);
export const isIron = (r: Categorizable): boolean => isBeef(r) || isLiver(r) || hasTag(r, TAGS.iron);
export const isChicken = (r: Categorizable): boolean => RX.chicken.test(r.name) || hasTag(r, TAGS.chicken);
export const isBreakfast = (r: Categorizable): boolean => RX.breakfast.test(r.name) || hasTag(r, TAGS.breakfast);
export const isDessert = (r: Categorizable): boolean => RX.dessert.test(r.name) || hasTag(r, TAGS.dessert);

// --- Недельные квоты (menu_rules §7.2/§7.5; iron — из tag_rules MIN_PER_WEEK). ---
export interface WeeklyQuotas {
  iron: number; // ≥3 железных приёма/нед (говядина+печень+ещё один)
  beef: number; // ≥1 говядина
  liver: number; // ≥1 печень
  fish: number; // ≥1 рыба (омега-3)
}

export const DEFAULT_QUOTAS: WeeklyQuotas = { iron: 3, beef: 1, liver: 1, fish: 1 };

/** Сколько раз один и тот же рецепт допустим за неделю (десерт мягче — пул мал). */
export const MAX_REPEAT = 2;
export const MAX_REPEAT_DESSERT = 3;

/** Совпадение тегов рецепта со слотом (нормированное 0..1). */
export function slotAffinity(recipe: Categorizable, slot: SlotTarget): number {
  if (slot.dessert) return isDessert(recipe) ? 1 : 0;
  const lc = new Set(recipe.mealTags.map((t) => t.toLowerCase()));
  let hit = 0;
  for (const t of slot.slotTags) if (lc.has(t.toLowerCase())) hit += 1;
  if (hit > 0) return Math.min(1, hit / 2);
  // эвристика по имени, если тегов слота нет
  if (slot.name === 'Завтрак') return isBreakfast(recipe) ? 0.6 : 0.1;
  return 0.3; // обед/ужин — большинство основных блюд подходят
}
