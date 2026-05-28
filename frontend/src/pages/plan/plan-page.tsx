import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import { Select } from '@/components/base/select/select';
import { fetchPlan, fetchPlans, type PlanDayDto } from '@/api/plans';

// Страница /plan — read-only просмотр недельного плана (Phase 3 acceptance).

function DayCard({ day }: { day: PlanDayDto }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-secondary bg-primary p-5">
      <header className="flex items-baseline justify-between">
        <h3 className="text-md font-semibold text-primary">{day.date.slice(0, 10)}</h3>
        {day.dayType && <span className="text-sm text-tertiary">{day.dayType}</span>}
      </header>
      <ul className="flex flex-col gap-3">
        {day.meals.map((meal) => (
          <li key={meal.id} className="flex flex-col gap-1 border-t border-secondary pt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-primary">{meal.name}</span>
              {meal.time && <span className="text-xs text-tertiary">{meal.time}</span>}
              {meal.mealTags.map((t) => (
                <span key={t} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-tertiary">
                  {t}
                </span>
              ))}
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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">План недели</h1>
        <p className="text-sm text-tertiary">Просмотр сгенерированного плана питания.</p>
      </header>

      {(userLoading || plansQuery.isLoading) && <p className="text-sm text-tertiary">Загрузка…</p>}

      {!userLoading && !hasUser && (
        <p className="text-sm text-tertiary">Нет пользователя. Засидите одного в БД.</p>
      )}

      {hasUser && plansQuery.data && weekItems.length === 0 && (
        <p className="text-sm text-tertiary">
          Планов пока нет. Сгенерируй план через <code>POST /api/plans</code>.
        </p>
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
