import type { ValidationInput, ValidationResult } from './types.js';

/**
 * Pure-функция: оценивает все активные правила пользователя против одного рецепта.
 * Никаких side-effects, никакой БД — данные приходят на вход.
 *
 * Контракт см. в docs/ARCHITECTURE.md §7.3 — Валидатор правил.
 *
 * **Recipe-level правила** (проверяются здесь):
 *  - BAN_TAG             — ни один ингредиент не должен иметь этот тег
 *  - BAN_TAG_IN_MEAL     — если рецепт помечен meal_tag, ни один ингредиент с tag_name
 *  - REQUIRE_TAG_IN_MEAL — если рецепт помечен meal_tag, хотя бы один ингредиент с tag_name
 *
 * **Week-level правила** (игнорируются — проверяются в scr-calc-week-plan):
 *  - MIN_PER_WEEK / MAX_PER_WEEK
 *
 * **Exception tag:** если рецепт имеет тег из `rule.exceptionTag` — правило пропускается.
 */
export function evaluateRules(input: ValidationInput): ValidationResult {
  const { ingredients, recipeMealTags, rules } = input;
  const reasons: string[] = [];

  for (const rule of rules) {
    // Скип, если у рецепта есть exception-тэг этого правила.
    if (rule.exceptionTag && recipeMealTags.includes(rule.exceptionTag)) {
      continue;
    }

    switch (rule.ruleKind) {
      case 'BAN_TAG': {
        const offender = ingredients.find((i) => i.tags.includes(rule.tagName));
        if (offender) {
          reasons.push(
            formatReason(
              `BAN_TAG(${rule.tagName})`,
              `ингредиент «${offender.name}» имеет этот тег`,
              rule.reason,
            ),
          );
        }
        break;
      }

      case 'BAN_TAG_IN_MEAL': {
        if (!rule.mealTag) break; // некорректно сконфигурировано — игнорируем
        if (!recipeMealTags.includes(rule.mealTag)) break; // правило не применяется к этому рецепту
        const offender = ingredients.find((i) => i.tags.includes(rule.tagName));
        if (offender) {
          reasons.push(
            formatReason(
              `BAN_TAG_IN_MEAL(${rule.tagName} в ${rule.mealTag})`,
              `ингредиент «${offender.name}» имеет тег ${rule.tagName}`,
              rule.reason,
            ),
          );
        }
        break;
      }

      case 'REQUIRE_TAG_IN_MEAL': {
        if (!rule.mealTag) break;
        if (!recipeMealTags.includes(rule.mealTag)) break;
        const hasIt = ingredients.some((i) => i.tags.includes(rule.tagName));
        if (!hasIt) {
          reasons.push(
            formatReason(
              `REQUIRE_TAG_IN_MEAL(${rule.tagName} в ${rule.mealTag})`,
              `не найден ингредиент с тегом ${rule.tagName}`,
              rule.reason,
            ),
          );
        }
        break;
      }

      case 'MIN_PER_WEEK':
      case 'MAX_PER_WEEK':
        // Week-level — проверяется в scr-calc-week-plan, не на уровне рецепта.
        break;
    }
  }

  return {
    isApproved: reasons.length === 0,
    rejectionReasons: reasons,
  };
}

function formatReason(prefix: string, body: string, ruleReason: string | null): string {
  const suffix = ruleReason ? ` — ${ruleReason}` : '';
  return `${prefix}: ${body}${suffix}`;
}
