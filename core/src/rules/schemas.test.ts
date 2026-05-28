import { describe, it, expect } from 'vitest';
import { RuleKind } from '@prisma/client';
import {
  nutritionTargetUpsertSchema,
  tagRuleCreateSchema,
  tagRuleUpdateSchema,
  userIdQuerySchema,
} from './schemas.js';

const UID = '11111111-1111-1111-1111-111111111111';

describe('userIdQuerySchema', () => {
  it('требует uuid', () => {
    expect(userIdQuerySchema.safeParse({ userId: 'x' }).success).toBe(false);
    expect(userIdQuerySchema.safeParse({ userId: UID }).success).toBe(true);
  });
});

describe('nutritionTargetUpsertSchema', () => {
  const valid = {
    userId: UID,
    kcalPerDay: 2200,
    proteinGPerDay: 150,
    fatGPerDay: 70,
    carbsGPerDay: 250,
  };

  it('валидирует минимально полный target', () => {
    expect(nutritionTargetUpsertSchema.safeParse(valid).success).toBe(true);
  });

  it('принимает опциональные proteinGPerKgMin + бюджеты', () => {
    const parsed = nutritionTargetUpsertSchema.parse({
      ...valid,
      proteinGPerKgMin: 1.4,
      budgetTargetRubPerWeek: 4000,
      budgetSoftCapRubPerWeek: 5000,
    });
    expect(parsed.proteinGPerKgMin).toBe(1.4);
  });

  it('отвергает неположительные КБЖУ', () => {
    expect(nutritionTargetUpsertSchema.safeParse({ ...valid, kcalPerDay: 0 }).success).toBe(false);
    expect(nutritionTargetUpsertSchema.safeParse({ ...valid, proteinGPerDay: -1 }).success).toBe(
      false,
    );
  });

  it('отвергает отсутствие обязательного поля', () => {
    const partial = {
      userId: UID,
      kcalPerDay: 2200,
      proteinGPerDay: 150,
      fatGPerDay: 70,
      // carbsGPerDay отсутствует
    };
    expect(nutritionTargetUpsertSchema.safeParse(partial).success).toBe(false);
  });
});

describe('tagRuleCreateSchema', () => {
  it('валидирует BAN_TAG + isActive default true', () => {
    const parsed = tagRuleCreateSchema.parse({
      userId: UID,
      ruleKind: RuleKind.BAN_TAG,
      tagName: 'garlic',
    });
    expect(parsed.isActive).toBe(true);
  });

  it('отвергает неизвестный ruleKind', () => {
    expect(
      tagRuleCreateSchema.safeParse({ userId: UID, ruleKind: 'NOPE', tagName: 'x' }).success,
    ).toBe(false);
  });

  it('MIN_PER_WEEK без quantity → fail, с quantity → ok', () => {
    expect(
      tagRuleCreateSchema.safeParse({ userId: UID, ruleKind: RuleKind.MIN_PER_WEEK, tagName: 'chicken' })
        .success,
    ).toBe(false);
    expect(
      tagRuleCreateSchema.safeParse({
        userId: UID,
        ruleKind: RuleKind.MIN_PER_WEEK,
        tagName: 'chicken',
        quantity: 4,
      }).success,
    ).toBe(true);
  });

  it('BAN_TAG_IN_MEAL без mealTag → fail, с mealTag → ok', () => {
    expect(
      tagRuleCreateSchema.safeParse({
        userId: UID,
        ruleKind: RuleKind.BAN_TAG_IN_MEAL,
        tagName: 'lactose',
      }).success,
    ).toBe(false);
    expect(
      tagRuleCreateSchema.safeParse({
        userId: UID,
        ruleKind: RuleKind.BAN_TAG_IN_MEAL,
        tagName: 'lactose',
        mealTag: 'iron_meal',
      }).success,
    ).toBe(true);
  });
});

describe('tagRuleUpdateSchema', () => {
  it('отвергает пустой patch', () => {
    expect(tagRuleUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('принимает частичный patch', () => {
    expect(tagRuleUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('разрешает явный null для nullable-полей (очистка)', () => {
    const parsed = tagRuleUpdateSchema.parse({ mealTag: null, quantity: null });
    expect(parsed.mealTag).toBeNull();
    expect(parsed.quantity).toBeNull();
  });
});
