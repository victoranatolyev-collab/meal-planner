import { z } from 'zod';

// Клиентская валидация формы целей КБЖУ. Зеркалит backend nutritionTargetUpsertSchema
// (core/src/rules/schemas.ts). Дублирование намеренно — клиент валидирует независимо.
//
// Пустое поле React Aria NumberField = NaN. Required-поля: finite() отвергает NaN.
// Optional-поля: union с NaN (пусто допустимо), submit отфильтрует нечисловые.

const required = (max: number) =>
  z
    .number({ invalid_type_error: 'Введите число' })
    .finite('Введите число')
    .positive('Должно быть больше 0')
    .max(max, `Не больше ${max}`);

const optional = (max: number) =>
  z.union([z.number().finite().positive().max(max, `Не больше ${max}`), z.nan()]);

export const nutritionTargetFormSchema = z.object({
  kcalPerDay: required(20000),
  proteinGPerDay: required(2000),
  fatGPerDay: required(2000),
  carbsGPerDay: required(2000),
  proteinGPerKgMin: optional(10),
  budgetTargetRubPerWeek: optional(1_000_000),
  budgetSoftCapRubPerWeek: optional(1_000_000),
});

export type NutritionTargetFormValues = z.infer<typeof nutritionTargetFormSchema>;
