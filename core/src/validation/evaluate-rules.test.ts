import { describe, it, expect } from 'vitest';
import { evaluateRules } from './evaluate-rules.js';
import type { IngredientView, RuleSnapshot } from './types.js';

// Хелперы для краткости тестов.
const ingr = (name: string, tags: string[]): IngredientView => ({
  id: name,
  name,
  tags,
});

const rule = (partial: Partial<RuleSnapshot> & Pick<RuleSnapshot, 'ruleKind' | 'tagName'>): RuleSnapshot => ({
  id: 'rule-' + Math.random().toString(36).slice(2, 6),
  mealTag: null,
  quantity: null,
  exceptionTag: null,
  reason: null,
  ...partial,
});

const baseInput = {
  recipeName: 'Тестовый рецепт',
  ingredients: [] as IngredientView[],
  recipeMealTags: [] as string[],
  rules: [] as RuleSnapshot[],
};

describe('evaluateRules', () => {
  it('пустой рецепт + 0 правил → approved', () => {
    const result = evaluateRules(baseInput);
    expect(result.isApproved).toBe(true);
    expect(result.rejectionReasons).toEqual([]);
  });

  it('BAN_TAG match → rejected с reasoning, ссылается на ингредиент', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Чеснок', ['garlic', 'vegetable'])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'garlic', reason: '§13a' })],
    });
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons[0]).toContain('BAN_TAG(garlic)');
    expect(result.rejectionReasons[0]).toContain('«Чеснок»');
    expect(result.rejectionReasons[0]).toContain('§13a');
  });

  it('BAN_TAG no match → approved', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Куриная грудка', ['protein', 'chicken'])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'garlic' })],
    });
    expect(result.isApproved).toBe(true);
  });

  it('BAN_TAG_IN_MEAL: meal_tag совпал + offender → rejected', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Молоко', ['lactose', 'dairy'])],
      recipeMealTags: ['iron_meal'],
      rules: [
        rule({
          ruleKind: 'BAN_TAG_IN_MEAL',
          tagName: 'lactose',
          mealTag: 'iron_meal',
          reason: 'iron rule',
        }),
      ],
    });
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons[0]).toContain('BAN_TAG_IN_MEAL(lactose в iron_meal)');
  });

  it('BAN_TAG_IN_MEAL: meal_tag не совпал → правило не применяется (approved)', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Молоко', ['lactose', 'dairy'])],
      recipeMealTags: ['breakfast'], // не iron_meal
      rules: [
        rule({ ruleKind: 'BAN_TAG_IN_MEAL', tagName: 'lactose', mealTag: 'iron_meal' }),
      ],
    });
    expect(result.isApproved).toBe(true);
  });

  it('REQUIRE_TAG_IN_MEAL: тег есть → approved', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Печень', ['iron', 'protein']), ingr('Лук', ['vegetable'])],
      recipeMealTags: ['iron_meal'],
      rules: [
        rule({ ruleKind: 'REQUIRE_TAG_IN_MEAL', tagName: 'iron', mealTag: 'iron_meal' }),
      ],
    });
    expect(result.isApproved).toBe(true);
  });

  it('REQUIRE_TAG_IN_MEAL: тега нет → rejected', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Курица', ['protein']), ingr('Лук', ['vegetable'])],
      recipeMealTags: ['iron_meal'],
      rules: [
        rule({ ruleKind: 'REQUIRE_TAG_IN_MEAL', tagName: 'iron', mealTag: 'iron_meal' }),
      ],
    });
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons[0]).toContain('REQUIRE_TAG_IN_MEAL(iron в iron_meal)');
  });

  it('exception_tag bypass: рецепт с c1_exclusion проходит правило', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Шоколад', ['dessert'])],
      recipeMealTags: ['sweet_tail', 'c1_exclusion'], // оба тега
      rules: [
        rule({
          ruleKind: 'BAN_TAG_IN_MEAL',
          tagName: 'dessert',
          mealTag: 'sweet_tail',
          exceptionTag: 'c1_exclusion',
        }),
      ],
    });
    expect(result.isApproved).toBe(true);
  });

  it('MIN/MAX_PER_WEEK игнорируются (week-level, не recipe-level)', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Курица', ['protein', 'chicken'])],
      rules: [
        rule({ ruleKind: 'MIN_PER_WEEK', tagName: 'chicken', quantity: 4 }),
        rule({ ruleKind: 'MAX_PER_WEEK', tagName: 'alcohol', quantity: 1 }),
      ],
    });
    expect(result.isApproved).toBe(true);
    expect(result.rejectionReasons).toEqual([]);
  });

  it('множественные нарушения: collects all reasons', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [
        ingr('Чеснок', ['garlic']),
        ingr('Майонез', ['mayo']),
      ],
      rules: [
        rule({ ruleKind: 'BAN_TAG', tagName: 'garlic' }),
        rule({ ruleKind: 'BAN_TAG', tagName: 'mayo' }),
      ],
    });
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons).toHaveLength(2);
  });
});
