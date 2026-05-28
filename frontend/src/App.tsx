import { Plus } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';

// Skeleton-страница. Реальный UI появится по фазам: /plan, /recipes, /cart, /diary, /rules, /schedule.
// UI-кит: Untitled UI React (Tailwind v4 + React Aria) — см. docs/ARCHITECTURE.md §5.

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-primary p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-display-sm font-semibold text-primary">Meal Planner</h1>
        <p className="text-md text-tertiary">Frontend на Untitled UI React</p>
      </div>
      <div className="flex gap-3">
        <Button size="md" color="primary" iconLeading={Plus}>
          Создать план
        </Button>
        <Button size="md" color="secondary">
          Правила питания
        </Button>
      </div>
    </main>
  );
}
