import type { IngredientView } from './types.js';

/**
 * Каталог жёстко исключённых продуктов (menu_rules.md §13a).
 *
 * Зачем модуль существует: tag-система оказалась дырявой — FIVEKA-импорт заводит
 * ингредиенты без тегов, а теги в каталоге шли вразнобой (рус «чеснок» vs eng «garlic»).
 * Поэтому BAN_TAG, который раньше сверял только `ingredient.tags`, пропускал чеснок/гречку/
 * майонез, попавшие в рецепты как нетегированные ингредиенты. См. docs/HISTORY.md 2026-05-31.
 *
 * Решение — defense-in-depth: для бан-тегов из §13a сверяем не только сам тег, но и
 * теги-синонимы И ключевые слова в названии ингредиента. Это делает BAN_TAG устойчивым
 * к нетегированным данным и к разнобою в языке тегов.
 *
 * Ключ карты = канонический tag_name правила (его кладём в tag_rules.tag_name).
 */
export interface BanSpec {
  /** Теги-синонимы: любой из них на ингредиенте = тот же бан (рус/eng разнобой каталога). */
  tagSynonyms: string[];
  /** Подстроки (lowercase) в названии ингредиента → тоже бан. */
  nameKeywords: string[];
}

export const BAN_KEYWORDS: Record<string, BanSpec> = {
  // 'греч' НЕ ловит «грецкий орех» (грец- ≠ греч-), но ловит «гречка/гречкой/гречневая».
  гречка: { tagSynonyms: ['grain_buckwheat', 'buckwheat'], nameKeywords: ['гречк', 'гречн', 'buckwheat'] },
  чеснок: { tagSynonyms: ['garlic'], nameKeywords: ['чеснок', 'чесночн', 'garlic'] },
  майонез: { tagSynonyms: ['mayo', 'mayonnaise'], nameKeywords: ['майонез', 'mayo'] },
  whey: { tagSynonyms: ['whey_protein'], nameKeywords: ['whey', 'сывороточн'] },
};

/** Все канонические бан-теги §13a (для сидов/скриптов). */
export const BAN_TAGS = Object.keys(BAN_KEYWORDS);

/**
 * Считается ли ингредиент нарушением бан-тега `tagName`.
 *
 * Прямое совпадение тега работает для ЛЮБОГО tagName (поведение старого BAN_TAG сохранено).
 * Если `tagName` — известный §13a-бан, дополнительно проверяем теги-синонимы и название.
 */
export function ingredientMatchesBan(ingredient: IngredientView, tagName: string): boolean {
  if (ingredient.tags.includes(tagName)) return true;

  const spec = BAN_KEYWORDS[tagName];
  if (!spec) return false;

  if (spec.tagSynonyms.some((t) => ingredient.tags.includes(t))) return true;

  const name = ingredient.name.toLowerCase();
  return spec.nameKeywords.some((kw) => name.includes(kw));
}

/**
 * Подпадает ли НАЗВАНИЕ рецепта под бан-тег `tagName`.
 *
 * Защита от рассинхрона имя↔состав: нормализатор иногда роняет/подменяет ингредиент,
 * но имя по-прежнему рекламирует запрещённый продукт («Куриная котлета с гречкой» без
 * самой гречки в составе). Для жёстких исключений §13a это всё равно нарушение.
 *
 * Только для известных §13a-банов. Риск ложного срабатывания на отрицании
 * («…без чеснока») осознанный: для hard-exclusion безопаснее демотировать спорное блюдо.
 */
export function recipeNameMatchesBan(recipeName: string, tagName: string): boolean {
  const spec = BAN_KEYWORDS[tagName];
  if (!spec) return false;
  const name = recipeName.toLowerCase();
  return spec.nameKeywords.some((kw) => name.includes(kw));
}

/**
 * Бан-теги, под которые подпадает ингредиент по названию/тегам.
 * Используется бэкафилл-скриптом, чтобы проставить ингредиентам канонические теги §13a.
 */
export function deriveBanTags(ingredient: IngredientView): string[] {
  return BAN_TAGS.filter((tag) => ingredientMatchesBan(ingredient, tag));
}
