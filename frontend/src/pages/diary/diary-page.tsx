import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import { Input } from '@/components/base/input/input';
import { Button } from '@/components/base/buttons/button';
import { createDiaryEntry, fetchDiary, type DiaryEntryDto } from '@/api/diary';

// Страница /diary — записать съеденное (scr-write-diary) + журнал с КБЖУ.

const toNum = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s));
const macro = (v: string | null): number => (v ? Number(v) : 0);

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function DiaryPage() {
  const { userId, hasUser, isLoading } = useCurrentUser();
  const qc = useQueryClient();
  const diaryQuery = useQuery({
    queryKey: ['diary', userId],
    queryFn: () => fetchDiary(userId as string),
    enabled: Boolean(userId),
  });

  const [name, setName] = useState('');
  const [meal, setMeal] = useState('');
  const [portion, setPortion] = useState('1');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createDiaryEntry({
        userId: userId as string,
        customName: name.trim(),
        mealName: meal.trim() || undefined,
        portionFactor: toNum(portion) ?? 1,
        kcal: toNum(kcal),
        proteinG: toNum(protein),
        fatG: toNum(fat),
        carbsG: toNum(carbs),
      }),
    onSuccess: () => {
      setName('');
      setMeal('');
      setKcal('');
      setProtein('');
      setFat('');
      setCarbs('');
      setPortion('1');
      void qc.invalidateQueries({ queryKey: ['diary', userId] });
    },
  });

  const entries: DiaryEntryDto[] = diaryQuery.data?.items ?? [];
  const totals = entries.reduce(
    (a, e) => ({
      kcal: a.kcal + macro(e.kcal),
      p: a.p + macro(e.proteinG),
      f: a.f + macro(e.fatG),
      c: a.c + macro(e.carbsG),
    }),
    { kcal: 0, p: 0, f: 0, c: 0 },
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">Дневник питания</h1>
        <p className="text-sm text-tertiary">Записывай съеденное — журнал и суммарные КБЖУ.</p>
      </header>

      {isLoading && <p className="text-sm text-tertiary">Загрузка…</p>}
      {!isLoading && !hasUser && <p className="text-sm text-tertiary">Нет пользователя в БД.</p>}

      {hasUser && (
        <>
          <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
            <h2 className="text-lg font-semibold text-primary">Добавить запись</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Что съели" placeholder="напр. Протеиновый батончик" value={name} onChange={setName} isRequired />
              <Input label="Приём пищи" placeholder="Завтрак / Обед / Перекус" value={meal} onChange={setMeal} />
              <Input label="Порций" type="number" value={portion} onChange={setPortion} />
              <Input label="Ккал" type="number" value={kcal} onChange={setKcal} />
              <Input label="Белки, г" type="number" value={protein} onChange={setProtein} />
              <Input label="Жиры, г" type="number" value={fat} onChange={setFat} />
              <Input label="Углеводы, г" type="number" value={carbs} onChange={setCarbs} />
            </div>
            {mutation.isError && (
              <p className="text-sm text-error-primary">
                Ошибка: {mutation.error instanceof Error ? mutation.error.message : 'не удалось'}
              </p>
            )}
            <div>
              <Button
                color="primary"
                size="md"
                isDisabled={!name.trim()}
                isLoading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Записать
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-primary">Журнал</h2>
              {entries.length > 0 && (
                <span className="text-sm text-tertiary">
                  Σ {Math.round(totals.kcal)} ккал · Б {Math.round(totals.p)} · Ж {Math.round(totals.f)} · У{' '}
                  {Math.round(totals.c)}
                </span>
              )}
            </div>

            {diaryQuery.isLoading && <p className="text-sm text-tertiary">Загрузка журнала…</p>}
            {!diaryQuery.isLoading && entries.length === 0 && (
              <p className="text-sm text-tertiary">Записей пока нет — добавь первую выше.</p>
            )}

            <ul className="flex flex-col gap-2">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-secondary bg-primary px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-primary">
                      {e.customName ?? 'Рецепт'}
                      {Number(e.portionFactor) !== 1 ? ` ×${e.portionFactor}` : ''}
                    </span>
                    <span className="text-xs text-tertiary">
                      {fmtDate(e.eatenAt)}
                      {e.mealName ? ` · ${e.mealName}` : ''}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm text-secondary">
                    {Math.round(macro(e.kcal))} ккал · Б {Math.round(macro(e.proteinG))} · Ж{' '}
                    {Math.round(macro(e.fatG))} · У {Math.round(macro(e.carbsG))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
