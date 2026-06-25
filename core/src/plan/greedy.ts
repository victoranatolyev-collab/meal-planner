import type { DraftDay } from './schemas.js';
import {
  distributionFor,
  isTrainingDay,
  slotAffinity,
  isIron,
  isBeef,
  isLiver,
  isFish,
  isDessert,
  DEFAULT_QUOTAS,
  MAX_REPEAT,
  MAX_REPEAT_DESSERT,
  type MacroTargets,
  type SlotTarget,
  type WeeklyQuotas,
} from './rules.js';

/** Кандидат-рецепт для greedy-композера (КБЖУ на 1 порцию + теги). */
export interface GreedyRecipe {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  mealTags: string[];
}

export type GreedyTargets = MacroTargets;

export interface GreedyDayInput {
  date: string;
  dayType?: string;
}

export interface GreedyOptions {
  /** Переопределение недельных квот (например, iron из tag_rules MIN_PER_WEEK). */
  quotas?: Partial<WeeklyQuotas>;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Сколько ещё ОСНОВНЫХ слотов (обед/ужин) осталось во всём плане, начиная с (di, si). */
function mainSlotsRemaining(days: GreedyDayInput[], slotsPerDay: SlotTarget[][], di: number, si: number): number {
  let n = 0;
  for (let d = di; d < days.length; d += 1) {
    const start = d === di ? si : 0;
    const slots = slotsPerDay[d]!;
    for (let s = start; s < slots.length; s += 1) {
      const slot = slots[s]!;
      if (!slot.dessert && slot.name !== 'Завтрак') n += 1;
    }
  }
  return n;
}

interface PlanState {
  usage: Map<string, number>;
  iron: number;
  beef: number;
  liver: number;
  fish: number;
}

/**
 * Скоринг кандидата под конкретный слот с учётом состояния недели.
 * Чем выше — тем лучше. Возвращает -Infinity, если рецепт нельзя ставить (исчерпан лимит повторов).
 */
function scoreRecipe(
  r: GreedyRecipe,
  slot: SlotTarget,
  st: PlanState,
  quotas: WeeklyQuotas,
  mainRemaining: number,
): number {
  const used = st.usage.get(r.id) ?? 0;
  const cap = slot.dessert ? MAX_REPEAT_DESSERT : MAX_REPEAT;
  if (used >= cap) return -Infinity;

  // 1. Слот-аффинити (главный сигнал): десерт строго из десертов.
  const aff = slotAffinity(r, slot);
  if (slot.dessert && aff === 0) return -Infinity;
  let score = aff * 100;
  // Десертное блюдо не должно занимать основной приём (обед/ужин).
  if (!slot.dessert && slot.name !== 'Завтрак' && isDessert(r)) score -= 200;

  // 2. Макро-пригодность: при порции под ккал слота — насколько БЖУ близки к таргету приёма.
  //    Ключ к ровному суточному белку: выбираем блюдо, чьё соотношение макросов само ложится
  //    в таргет при масштабе под калории (одним portionFactor нельзя попасть и в ккал, и в белок).
  const base = r.kcal > 0 ? r.kcal : slot.kcal;
  const pfNatural = slot.kcal / base; // порция, дающая калорийность слота
  if (pfNatural < 0.4) score -= 40; // блюдо слишком калорийное даже на 0.5 порции
  if (pfNatural > slot.maxPF + 0.6) score -= 30; // слишком лёгкое — придётся раздувать
  const pf = clamp(pfNatural, 0.5, slot.maxPF);
  const rel = (a: number, t: number): number => (t > 0 ? Math.abs(a - t) / t : 0);
  // Белок — приоритетный макрос (норма высокого белка), углеводы средне, жир мягко.
  const macroDev =
    1.0 * rel(r.proteinG * pf, slot.proteinG) +
    0.4 * rel(r.carbsG * pf, slot.carbsG) +
    0.3 * rel(r.fatG * pf, slot.fatG);
  score -= macroDev * 55;

  // 3. Недельные квоты: добор по железу/рыбе с нарастающей срочностью.
  const addQuota = (done: number, need: number, isType: boolean): number => {
    if (!isType || done >= need) return 0;
    const urgency = mainRemaining > 0 ? (need - done) / mainRemaining : 1;
    return 30 + urgency * 120; // чем меньше слотов осталось — тем сильнее тянем квоту
  };
  if (!slot.dessert && slot.name !== 'Завтрак') {
    score += addQuota(st.beef, quotas.beef, isBeef(r));
    score += addQuota(st.liver, quotas.liver, isLiver(r));
    score += addQuota(st.fish, quotas.fish, isFish(r));
    score += addQuota(st.iron, quotas.iron, isIron(r));
  }

  // 4. Анти-повтор: сильный штраф за уже использованные.
  score -= used * 60;

  return score;
}

/**
 * Детерминированный greedy-композер плана недели по правилам распределения и подбора (rules.ts).
 *
 * Распределение: завтрак — крупнейший приём, тренировочные дни (пн/чт) с post-workout обедом
 * (norms §9). Подбор: слот-аффинити по тегам + добор недельных квот (железо≥3, говядина/печень/
 * рыба ≥1) + анти-повтор (≤2× за неделю, десерт ≤3×). КБЖУ слота масштабируются под дневную цель.
 *
 * portionFactor масштабирует рецепт под целевую калорийность приёма (clamp 0.5..maxPF).
 * Возвращает дерево DraftDay[] — полная совместимость с persist/resolve.
 */
export function composePlanGreedy(
  targets: GreedyTargets,
  days: GreedyDayInput[],
  recipes: GreedyRecipe[],
  options: GreedyOptions = {},
): { days: DraftDay[] } {
  if (recipes.length === 0) {
    throw new Error('Пустой пул рецептов — greedy-композеру нечем заполнять план');
  }

  const quotas: WeeklyQuotas = { ...DEFAULT_QUOTAS, ...options.quotas };

  // Предрасчёт раскладки каждого дня (для подсчёта остатка основных слотов).
  const slotsPerDay = days.map((d) => distributionFor(isTrainingDay(d.date, d.dayType), targets));

  const st: PlanState = { usage: new Map(), iron: 0, beef: 0, liver: 0, fish: 0 };

  const resultDays: DraftDay[] = days.map((day, di) => {
    const slots = slotsPerDay[di]!;
    const meals = slots.map((slot, si) => {
      const mainRemaining = mainSlotsRemaining(days, slotsPerDay, di, si);

      // Выбираем кандидата с максимальным score; тай-брейк — стабильно по имени.
      let best: GreedyRecipe | null = null;
      let bestScore = -Infinity;
      for (const r of recipes) {
        const sc = scoreRecipe(r, slot, st, quotas, mainRemaining);
        if (sc > bestScore || (sc === bestScore && best && r.name < best.name)) {
          bestScore = sc;
          best = r;
        }
      }
      const recipe = best ?? recipes[0]!;

      // Обновляем состояние недели.
      st.usage.set(recipe.id, (st.usage.get(recipe.id) ?? 0) + 1);
      if (!slot.dessert && slot.name !== 'Завтрак') {
        if (isBeef(recipe)) st.beef += 1;
        if (isLiver(recipe)) st.liver += 1;
        if (isFish(recipe)) st.fish += 1;
        if (isIron(recipe)) st.iron += 1;
      }

      const baseKcal = recipe.kcal > 0 ? recipe.kcal : slot.kcal;
      const portionFactor = round2(clamp(slot.kcal / baseKcal, 0.5, slot.maxPF));

      // Теги приёма: канонические теги слота + признаки (post_workout / десерт уже в slotTags).
      const mealTags = slot.slotTags.filter((t) => t !== 'training_day');

      return {
        name: slot.name,
        time: slot.time,
        mealTags,
        items: [{ recipeId: recipe.id, portionFactor, fromStock: false, tail: slot.dessert }],
      };
    });

    return {
      date: day.date,
      ...(day.dayType ? { dayType: day.dayType } : {}),
      meals,
    };
  });

  return { days: resultDays };
}
