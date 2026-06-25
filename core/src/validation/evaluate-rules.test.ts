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

  // --- §13a defense-in-depth: BAN_TAG ловит даже нетегированные ингредиенты ---

  it('BAN_TAG(чеснок): нетегированный ингредиент пойман по названию', () => {
    const result = evaluateRules({
      ...baseInput,
      // как приходит из FIVEKA-импорта — без тегов
      ingredients: [ingr('Приправа Рестория Томаты и Базилик с чесноком 15г', [])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'чеснок', reason: '§13a' })],
    });
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons[0]).toContain('BAN_TAG(чеснок)');
    expect(result.rejectionReasons[0]).toContain('§13a');
  });

  it('BAN_TAG(гречка): пойман по названию, но «грецкий орех» НЕ ловится', () => {
    const buckwheat = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Гречка ядрица 900г', [])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'гречка' })],
    });
    expect(buckwheat.isApproved).toBe(false);

    const walnut = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Грецкий орех', [])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'гречка' })],
    });
    expect(walnut.isApproved).toBe(true);
  });

  it('BAN_TAG(чеснок): пойман по тегу-синониму garlic', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Чеснок свежий', ['garlic', 'vegetable'])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'чеснок' })],
    });
    expect(result.isApproved).toBe(false);
  });

  it('BAN_TAG(майонез): майонезный соус пойман по названию', () => {
    const result = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Соус Махеевъ Салатный майонезный 370мл', [])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'майонез' })],
    });
    expect(result.isApproved).toBe(false);
  });

  it('BAN_TAG(гречка): имя рекламирует гречку, но в составе её нет → всё равно rejected', () => {
    const result = evaluateRules({
      ...baseInput,
      recipeName: 'Куриная котлета с гречкой',
      ingredients: [ingr('Куриное филе', ['protein']), ingr('Сухари панировочные', [])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'гречка' })],
    });
    expect(result.isApproved).toBe(false);
    expect(result.rejectionReasons[0]).toContain('название рецепта');
  });

  it('BAN_TAG с неизвестным тегом (свинина): поведение прежнее — только точный тег', () => {
    // имя содержит «свинина», но без keyword-карты name-match не применяется
    const byName = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Шпик соленый со свининой', [])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'свинина' })],
    });
    expect(byName.isApproved).toBe(true);

    const byTag = evaluateRules({
      ...baseInput,
      ingredients: [ingr('Шпик', ['свинина'])],
      rules: [rule({ ruleKind: 'BAN_TAG', tagName: 'свинина' })],
    });
    expect(byTag.isApproved).toBe(false);
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
