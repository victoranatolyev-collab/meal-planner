import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import { fetchStock, type StockLineDto } from '@/api/stock';
import { fetchIngredients } from '@/api/ingredients';

// Страница /stock — проекция остатков (scr-calc-stock): запас + закупки − съедено.

export default function StockPage() {
  const { userId, hasUser, isLoading } = useCurrentUser();
  const stockQuery = useQuery({
    queryKey: ['stock', userId],
    queryFn: () => fetchStock(userId as string),
    enabled: Boolean(userId),
  });
  const ingQuery = useQuery({ queryKey: ['ingredients'], queryFn: fetchIngredients });

  const names = new Map((ingQuery.data?.items ?? []).map((i) => [i.id, i.name]));
  const lines: StockLineDto[] = (stockQuery.data?.lines ?? [])
    .slice()
    .sort((a, b) => a.projectedG - b.projectedG);

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

      {hasUser && stockQuery.isLoading && <p className="text-sm text-tertiary">Загрузка остатков…</p>}

      {hasUser && !stockQuery.isLoading && lines.length === 0 && (
        <p className="text-sm text-tertiary">
          Данных нет. Остатки появятся после инвентаризации, заказов или записей в дневнике.
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
