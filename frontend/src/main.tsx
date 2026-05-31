import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { AppLayout } from './app-layout';
import App from './App';
import RulesPage from './pages/rules/rules-page';
import PlanPage from './pages/plan/plan-page';
import AgentPage from './pages/agent/agent-page';
import DiaryPage from './pages/diary/diary-page';
import StockPage from './pages/stock/stock-page';
import CartPage from './pages/cart/cart-page';
import RecipesPage from './pages/recipes/recipes-page';
import './styles/globals.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <App /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'recipes', element: <RecipesPage /> },
      { path: 'diary', element: <DiaryPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'agent', element: <AgentPage /> },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
