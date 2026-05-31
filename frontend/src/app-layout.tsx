import { NavLink, Outlet } from 'react-router';
import { cx } from '@/utils/cx';

// Общий layout с верхней навигацией по всем разделам.
const NAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Главная', end: true },
  { to: '/plan', label: 'План' },
  { to: '/recipes', label: 'Блюда' },
  { to: '/diary', label: 'Дневник' },
  { to: '/stock', label: 'Остатки' },
  { to: '/cart', label: 'Корзина' },
  { to: '/rules', label: 'Правила' },
  { to: '/agent', label: 'Агент' },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-primary">
      <nav className="sticky top-0 z-10 border-b border-secondary bg-primary/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-4 py-3">
          <NavLink to="/" className="mr-3 shrink-0 font-semibold text-primary">
            🍽 Meal Planner
          </NavLink>
          {NAV.slice(1).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm transition',
                  isActive
                    ? 'bg-secondary font-medium text-primary'
                    : 'text-tertiary hover:text-primary',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
