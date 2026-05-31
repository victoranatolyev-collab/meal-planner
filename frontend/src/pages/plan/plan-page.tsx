import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import { Select } from '@/components/base/select/select';
import { Input } from '@/components/base/input/input';
import { Button } from '@/components/base/buttons/button';
import { fetchPlan, fetchPlans, generatePlan, type PlanDayDto, type PlanMealDto } from '@/api/plans';

// Страница /plan — read-only просмотр недельного плана (Phase 3 acceptance).

interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

const num = (v: string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** КБЖУ приёма = Σ по позициям (КБЖУ рецепта × portionFactor). */
function mealMacros(meal: PlanMealDto): Macros {
  return meal.items.reduce<Macros>(
    (acc, it) => {
      const pf = num(it.portionFactor);
      const r = it.recipe;
      return {
        kcal: acc.kcal + num(r?.totalKcal) * pf,
        protein: acc.protein + num(r?.totalProteinG) * pf,
        fat: acc.fat + num(r?.totalFatG) * pf,
        carbs: acc.carbs + num(r?.totalCarbsG) * pf,
      };
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  fat: a.fat + b.fat,
  carbs: a.carbs + b.carbs,
});

/** Компактная строка КБЖУ: «660 ккал · Б 33 · Ж 19 · У 49». */
function MacroLine({ m, className = '' }: { m: Macros; className?: string }) {
  return (
    <span className={className}>
      {Math.round(m.kcal)} ккал · Б {Math.round(m.protein)} · Ж {Math.round(m.fat)} · У{' '}
      {Math.round(m.carbs)}
    </span>
  );
}

function DayCard({ day }: { day: PlanDayDto }) {
  const dayTotal = day.meals.map(mealMacros).reduce(addMacros, {
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-secondary bg-primary p-5">
      <header className="flex items-baseline justify-between">
        <h3 className="text-md font-semibold text-primary">{day.date.slice(0, 10)}</h3>
        {day.dayType && <span className="text-sm text-tertiary">{day.dayType}</span>}
      </header>
      <ul className="flex flex-col gap-3">
        {day.meals.map((meal) => (
          <li key={meal.id} className="flex flex-col gap-1 border-t border-secondary pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-primary">{meal.name}</span>
                {meal.time && <span className="text-xs text-tertiary">{meal.time}</span>}
                {meal.mealTags.map((t) => (
                  <span key={t} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-tertiary">
                    {t}
                  </span>
                ))}
              </div>
              <MacroLine m={mealMacros(meal)} className="shrink-0 text-xs tabular-nums text-tertiary" />
            </div>
            <ul className="flex flex-col gap-0.5 pl-3">
              {meal.items.map((it, i) => (
                <li key={`${it.recipeId}-${i}`} className="text-sm text-secondary">
                  {it.recipe?.name ?? it.recipeId}
                  {Number(it.portionFactor) !== 1 ? ` ×${it.portionFactor}` : ''}
                  {it.fromStock ? ' · из остатков' : ''}
                  {it.tail ? ' · хвост' : ''}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <footer className="flex items-baseline justify-between border-t border-secondary pt-3">
        <span className="text-sm font-medium text-primary">За день</span>
        <MacroLine m={dayTotal} className="shrink-0 text-sm font-medium tabular-nums text-secondary" />
      </footer>
    </section>
  );
}

export default function PlanPage() {
  const { userId, hasUser, isLoading: userLoading } = useCurrentUser();
  const plansQuery = useQuery({
    queryKey: ['plans', userId],
    queryFn: () => fetchPlans(userId as string),
    enabled: Boolean(userId),
  });

  const [weekIso, setWeekIso] = useState<string | null>(null);
  useEffect(() => {
    const first = plansQuery.data?.items[0];
    if (first && weekIso === null) setWeekIso(first.weekIso);
  }, [plansQuery.data, weekIso]);

  const planQuery = useQuery({
    queryKey: ['plan', userId, weekIso],
    queryFn: () => fetchPlan(userId as string, weekIso as string),
    enabled: Boolean(userId) && Boolean(weekIso),
  });

  const weekItems = (plansQuery.data?.items ?? []).map((p) => ({
    id: p.weekIso,
    label: `${p.weekIso} · ${p.status}`,
  }));
  const plan = planQuery.data;

  const qc = useQueryClient();
  const [genWeek, setGenWeek] = useState('2026-W22');
  const [genStart, setGenStart] = useState('2026-05-25');
  const genMut = useMutation({
    mutationFn: () => generatePlan(userId as string, genWeek.trim(), genStart.trim()),
    onSuccess: (res) => {
      setWeekIso(res.weekIso);
      void qc.invalidateQueries({ queryKey: ['plans', userId] });
      void qc.invalidateQueries({ queryKey: ['plan', userId, res.weekIso] });
    },
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">План недели</h1>
        <p className="text-sm text-tertiary">Сгенерируй и просмотри план питания.</p>
      </header>

      {hasUser && (
        <section className="flex flex-wrap items-end gap-3 rounded-xl border border-secondary bg-primary p-6">
          <div className="w-36">
            <Input label="Неделя (ISO)" value={genWeek} onChange={setGenWeek} placeholder="2026-W22" />
          </div>
          <div className="w-44">
            <Input label="Старт (пн)" type="date" value={genStart} onChange={setGenStart} />
          </div>
          <Button color="primary" size="md" isLoading={genMut.isPending} onClick={() => genMut.mutate()}>
            {weekItems.length > 0 ? 'Сгенерировать заново' : 'Сгенерировать'}
          </Button>
          {genMut.isError && (
            <p className="w-full text-sm text-error-primary">
              Ошибка: {genMut.error instanceof Error ? genMut.error.message : 'не удалось'}
            </p>
          )}
          {genMut.isSuccess && (
            <p className="w-full text-sm text-tertiary">
              Готово: {genMut.data.days} дн · {genMut.data.meals} приёмов · {genMut.data.items} позиций.
            </p>
          )}
        </section>
      )}

      {(userLoading || plansQuery.isLoading) && <p className="text-sm text-tertiary">Загрузка…</p>}

      {!userLoading && !hasUser && (
        <p className="text-sm text-tertiary">Нет пользователя. Засидите одного в БД.</p>
      )}

      {hasUser && plansQuery.data && weekItems.length === 0 && (
        <p className="text-sm text-tertiary">Планов пока нет — сгенерируй первый выше.</p>
      )}

      {weekItems.length > 0 && weekIso && (
        <>
          <div className="max-w-xs">
            <Select
              label="Неделя"
              items={weekItems}
              selectedKey={weekIso}
              onSelectionChange={(k) => setWeekIso(String(k))}
            >
              {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
          </div>

          {plan && (
            <p className="text-sm text-tertiary">
              Цель: {plan.kcalTarget} ккал · Б {plan.proteinGTarget} · Ж {plan.fatGTarget} · У{' '}
              {plan.carbsGTarget} · статус {plan.status}
            </p>
          )}

          {planQuery.isLoading && <p className="text-sm text-tertiary">Загрузка плана…</p>}

          {plan && (
            <div className="flex flex-col gap-4">
              {plan.days.map((day) => (
                <DayCard key={day.id} day={day} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
