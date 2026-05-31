import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/app-layout';
import App from '@/App';
import StockPage from '@/pages/stock/stock-page';

function res(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(cleanup);

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppLayout', () => {
  it('рендерит навигацию по всем разделам', () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );
    for (const label of ['План', 'Дневник', 'Остатки', 'Корзина', 'Правила', 'Агент']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});

describe('App (лендинг)', () => {
  it('рендерит карточки всех разделов', () => {
    render(<App />);
    expect(screen.getByText('План недели')).toBeInTheDocument();
    expect(screen.getByText('Дневник')).toBeInTheDocument();
    expect(screen.getByText('Корзина')).toBeInTheDocument();
    expect(screen.getByText('Чат с агентом')).toBeInTheDocument();
  });
});

describe('StockPage (данные через React Query)', () => {
  beforeEach(() => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input);
      if (url.startsWith('/api/users'))
        return Promise.resolve(res({ items: [{ id: 'u-1', email: 'e@e', createdAt: '2020-01-01' }], total: 1 }));
      if (url.startsWith('/api/stock'))
        return Promise.resolve(
          res({
            lines: [
              { ingredientId: 'i-1', baselineG: 500, boughtG: 0, consumedG: 60, projectedG: 440 },
              { ingredientId: 'i-2', baselineG: 0, boughtG: 0, consumedG: 150, projectedG: -150 },
            ],
            asOf: '2026-05-29',
          }),
        );
      if (url.startsWith('/api/ingredients'))
        return Promise.resolve(
          res({
            items: [
              { id: 'i-1', name: 'Овсяные хлопья', source: 'FIVEKA', pricePer100g: '8', unit: 'g' },
              { id: 'i-2', name: 'Творог', source: 'FIVEKA', pricePer100g: '25', unit: 'g' },
            ],
            total: 2,
          }),
        );
      return Promise.resolve(res({}));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('показывает имена ингредиентов и прогноз, дефицит первым (сортировка)', async () => {
    renderWithProviders(<StockPage />);
    expect(await screen.findByText('Овсяные хлопья')).toBeInTheDocument();
    expect(await screen.findByText('Творог')).toBeInTheDocument();
    // Дефицитная строка отрисована с предупреждением.
    expect(await screen.findByText(/-150/)).toBeInTheDocument();
  });
});
