import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import {
  fetchStock,
  fetchStockBaseline,
  upsertStockItem,
  deleteStockItem,
  type StockLineDto,
} from '@/api/stock';
import { fetchIngredients, searchIngredients, type IngredientDto } from '@/api/ingredients';

// Страница /stock — проекция остатков + редактор базового запаса (инвентаризация).

const inputCx =
  'w-full rounded-md border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-tertiary';

/** Поисковый пикер ингредиента (по подстроке имени). */
function IngredientPicker({ onPick }: { onPick: (d: IngredientDto) => void }) {
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['ingredient-search', q],
    queryFn: () => searchIngredients(q),
    enabled: q.trim().length >= 2,
  });
  const items = results.data?.items ?? [];

  return (
    <div className="relative">
      <input
        className={inputCx}
        placeholder="Добавить продукт в запас — поиск (от 2 букв)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-secondary bg-primary shadow-md">
          {items.length === 0 && (
            <li className="px-3 py-2 text-sm text-tertiary">
              {results.isLoading ? 'Поиск…' : 'Ничего не найдено'}
            </li>
          )}
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  onPick(it);
                  setQ('');
                }}
              >
                <span className="text-primary">{it.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-tertiary">
                  {Math.round(Number(it.kcal100g ?? 0))} ккал/100г
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StockPage() {
  const { userId, hasUser, isLoading } = useCurrentUser();
  const qc = useQueryClient();
  const stockQuery = useQuery({
    queryKey: ['stock', userId],
    queryFn: () => fetchStock(userId as string),
    enabled: Boolean(userId),
  });
  const ingQuery = useQuery({ queryKey: ['ingredients'], queryFn: fetchIngredients });
  const baselineQuery = useQuery({
    queryKey: ['stock-baseline', userId],
    queryFn: () => fetchStockBaseline(userId as string),
    enabled: Boolean(userId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['stock-baseline', userId] });
    void qc.invalidateQueries({ queryKey: ['stock', userId] });
  };
  const upsertMut = useMutation({
    mutationFn: ({ ingredientId, qtyG }: { ingredientId: string; qtyG: number }) =>
      upsertStockItem(userId as string, ingredientId, qtyG),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (ingredientId: string) => deleteStockItem(userId as string, ingredientId),
    onSuccess: invalidate,
  });

  const names = new Map((ingQuery.data?.items ?? []).map((i) => [i.id, i.name]));
  const lines: StockLineDto[] = (stockQuery.data?.lines ?? [])
    .slice()
    .sort((a, b) => a.projectedG - b.projectedG);
  const baseline = baselineQuery.data?.items ?? [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">Остатки продуктов</h1>
        <p className="text-sm text-tertiary">
          Прогноз = текущий запас + закупки − съедено (по дневнику). Отрицательный = дефицит.
        </p>
      </header>

      {isLoading && <p className="text-sm text-tertiary">Загрузка…</p>}
      {!isLoading && !hasUser && <p className="text-sm text-tertiary">Нет пользователя в БД.</p>}

      {/* Редактор базового запаса (инвентаризация) */}
      {hasUser && (
        <section className="flex flex-col gap-3 rounded-xl border border-secondary bg-primary p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-md font-semibold text-primary">Запас дома (инвентаризация)</h2>
            <p className="text-xs text-tertiary">
              Что реально есть дома сейчас. Это «запас» в прогнозе. Найди продукт и укажи граммы.
            </p>
          </div>

          <IngredientPicker
            onPick={(d) => upsertMut.mutate({ ingredientId: d.id, qtyG: 100 })}
          />

          {baseline.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {baseline.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 border-t border-secondary py-2"
                >
                  <span className="flex-1 text-sm text-primary">{b.ingredient.name}</span>
                  <input
                    type="number"
                    defaultValue={b.qtyG}
                    className="w-24 shrink-0 rounded-md border border-secondary bg-primary px-2 py-1.5 text-right text-sm text-primary"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v !== b.qtyG)
                        upsertMut.mutate({ ingredientId: b.ingredientId, qtyG: v });
                    }}
                  />
                  <span className="text-xs text-tertiary">г</span>
                  <button
                    type="button"
                    className="shrink-0 px-1 text-sm text-tertiary hover:text-error-primary"
                    onClick={() => deleteMut.mutate(b.ingredientId)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-tertiary">Запас пуст — добавь продукты выше.</p>
          )}
          {(upsertMut.isError || deleteMut.isError) && (
            <p className="text-sm text-error-primary">Не удалось сохранить — попробуй ещё раз.</p>
          )}
        </section>
      )}

      {hasUser && stockQuery.isLoading && <p className="text-sm text-tertiary">Загрузка остатков…</p>}

      {hasUser && !stockQuery.isLoading && lines.length === 0 && (
        <p className="text-sm text-tertiary">
          Прогноза пока нет. Заполни запас выше, оформи заказ или запиши приёмы в дневник.
        </p>
      )}

      {lines.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-secondary">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-tertiary">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Ингредиент</th>
                <th className="px-4 py-2.5 text-right font-medium">Запас</th>
                <th className="px-4 py-2.5 text-right font-medium">Закуплено</th>
                <th className="px-4 py-2.5 text-right font-medium">Съедено</th>
                <th className="px-4 py-2.5 text-right font-medium">Прогноз, г</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const deficit = l.projectedG < 0;
                return (
                  <tr key={l.ingredientId} className="border-t border-secondary">
                    <td className="px-4 py-2.5 text-primary">
                      {names.get(l.ingredientId) ?? l.ingredientId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-secondary">{l.baselineG}</td>
                    <td className="px-4 py-2.5 text-right text-secondary">{l.boughtG}</td>
                    <td className="px-4 py-2.5 text-right text-secondary">{l.consumedG}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${deficit ? 'text-error-primary' : 'text-primary'}`}
                    >
                      {l.projectedG}
                      {deficit ? ' ⚠' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
