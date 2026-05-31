import { useEffect } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InputNumber } from '@/components/base/input/input-number';
import { Button } from '@/components/base/buttons/button';
import {
  fetchNutritionTarget,
  putNutritionTarget,
  type NutritionTargetUpsertBody,
} from '@/api/nutrition-targets';
import { fetchNorms } from '@/api/norms';
import { ApiError } from '@/api/client';
import { nutritionTargetFormSchema, type NutritionTargetFormValues } from './form-schema';

const EMPTY: NutritionTargetFormValues = {
  kcalPerDay: NaN,
  proteinGPerDay: NaN,
  fatGPerDay: NaN,
  carbsGPerDay: NaN,
  proteinGPerKgMin: NaN,
  budgetTargetRubPerWeek: NaN,
  budgetSoftCapRubPerWeek: NaN,
};

const toNum = (s: string | null): number => (s === null ? NaN : Number(s));

function NumberField({
  control,
  name,
  label,
}: {
  control: Control<NutritionTargetFormValues>;
  name: keyof NutritionTargetFormValues;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <InputNumber
          label={label}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          minValue={0}
          isInvalid={Boolean(fieldState.error)}
          hint={fieldState.error?.message}
        />
      )}
    />
  );
}

export function NutritionTargetForm({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const targetQuery = useQuery({
    queryKey: ['nutrition-target', userId],
    queryFn: () => fetchNutritionTarget(userId),
  });

  const { control, handleSubmit, reset } = useForm<NutritionTargetFormValues>({
    resolver: zodResolver(nutritionTargetFormSchema),
    defaultValues: EMPTY,
  });

  // Prefill формы при загрузке существующих целей.
  useEffect(() => {
    const t = targetQuery.data;
    if (!t) return;
    reset({
      kcalPerDay: toNum(t.kcalPerDay),
      proteinGPerDay: toNum(t.proteinGPerDay),
      fatGPerDay: toNum(t.fatGPerDay),
      carbsGPerDay: toNum(t.carbsGPerDay),
      proteinGPerKgMin: toNum(t.proteinGPerKgMin),
      budgetTargetRubPerWeek: toNum(t.budgetTargetRubPerWeek),
      budgetSoftCapRubPerWeek: toNum(t.budgetSoftCapRubPerWeek),
    });
  }, [targetQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: putNutritionTarget,
    onSuccess: (data) => qc.setQueryData(['nutrition-target', userId], data),
  });

  // «Пересчитать по профилю»: формула calcNorms на текущей антропометрии → заполнить поля + сохранить.
  // Бюджеты НЕ трогаем (не передаём в теле → Prisma сохраняет прежние). Обновление query →
  // эффект prefill перезальёт поля формы новыми значениями.
  const recalc = useMutation({
    mutationFn: async () => {
      const n = await fetchNorms(userId);
      const body: NutritionTargetUpsertBody = {
        userId,
        kcalPerDay: n.kcalPerDay,
        proteinGPerDay: n.proteinGPerDay,
        fatGPerDay: n.fatGPerDay,
        carbsGPerDay: n.carbsGPerDay,
        proteinGPerKgMin: n.breakdown.proteinGPerKg,
      };
      return putNutritionTarget(body);
    },
    onSuccess: (data) => qc.setQueryData(['nutrition-target', userId], data),
  });

  const recalcErrorText =
    recalc.error instanceof ApiError && recalc.error.status === 422
      ? 'Нет антропометрии — заполните профиль (рост/вес/возраст/активность)'
      : recalc.isError
        ? 'Не удалось пересчитать'
        : null;

  const onSubmit = (values: NutritionTargetFormValues) => {
    const body: NutritionTargetUpsertBody = {
      userId,
      kcalPerDay: values.kcalPerDay,
      proteinGPerDay: values.proteinGPerDay,
      fatGPerDay: values.fatGPerDay,
      carbsGPerDay: values.carbsGPerDay,
    };
    if (Number.isFinite(values.proteinGPerKgMin)) body.proteinGPerKgMin = values.proteinGPerKgMin;
    if (Number.isFinite(values.budgetTargetRubPerWeek))
      body.budgetTargetRubPerWeek = values.budgetTargetRubPerWeek;
    if (Number.isFinite(values.budgetSoftCapRubPerWeek))
      body.budgetSoftCapRubPerWeek = values.budgetSoftCapRubPerWeek;
    mutation.mutate(body);
  };

  if (targetQuery.isLoading) {
    return <p className="text-sm text-tertiary">Загрузка целей…</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField control={control} name="kcalPerDay" label="Калории, ккал/день" />
        <NumberField control={control} name="proteinGPerDay" label="Белки, г/день" />
        <NumberField control={control} name="fatGPerDay" label="Жиры, г/день" />
        <NumberField control={control} name="carbsGPerDay" label="Углеводы, г/день" />
        <NumberField control={control} name="proteinGPerKgMin" label="Белок, г/кг (мин)" />
        <NumberField control={control} name="budgetTargetRubPerWeek" label="Бюджет ₽/нед (цель)" />
        <NumberField control={control} name="budgetSoftCapRubPerWeek" label="Бюджет ₽/нед (макс)" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="md" color="primary" isLoading={mutation.isPending}>
          Сохранить
        </Button>
        <Button
          type="button"
          size="md"
          color="secondary"
          isLoading={recalc.isPending}
          isDisabled={mutation.isPending}
          onClick={() => recalc.mutate()}
        >
          Пересчитать по профилю
        </Button>
        {mutation.isSuccess && <span className="text-sm text-success-primary">Сохранено</span>}
        {mutation.isError && (
          <span className="text-sm text-error-primary">Ошибка сохранения</span>
        )}
        {recalc.isSuccess && (
          <span className="text-sm text-success-primary">Пересчитано и сохранено</span>
        )}
        {recalcErrorText && <span className="text-sm text-error-primary">{recalcErrorText}</span>}
      </div>
      <p className="text-xs text-tertiary">
        «Пересчитать по профилю» применяет формулу к текущей антропометрии (шаги, силовые/кардио,
        вес) и заполняет цели: белок 1.8 г/кг, жир 0.8 г/кг, углеводы — остаток. Бюджет не меняется.
      </p>
    </form>
  );
}
