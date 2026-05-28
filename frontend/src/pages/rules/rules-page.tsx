import { useCurrentUser } from '@/lib/use-current-user';
import { NutritionTargetForm } from './nutrition-target-form';

// Страница /rules — управление правилами питания.
// Шаг 1 (эта итерация): целевые КБЖУ + бюджет. Шаг 2: CRUD tag-rules.

export default function RulesPage() {
  const { userId, hasUser, isLoading, error } = useCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">Правила питания</h1>
        <p className="text-sm text-tertiary">Целевые КБЖУ и бюджет на неделю.</p>
      </header>

      {isLoading && <p className="text-sm text-tertiary">Загрузка…</p>}

      {error && (
        <p className="text-sm text-error-primary">Не удалось загрузить пользователя.</p>
      )}

      {!isLoading && !hasUser && (
        <p className="text-sm text-tertiary">
          Нет пользователя в БД. Засидите одного (seed) и обновите страницу.
        </p>
      )}

      {hasUser && userId && (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
          <h2 className="text-lg font-semibold text-primary">Целевые КБЖУ</h2>
          <NutritionTargetForm userId={userId} />
        </section>
      )}
    </main>
  );
}
