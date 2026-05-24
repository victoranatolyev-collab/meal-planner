// Минимальный root layout — требование Next.js App Router.
// Backend в нашей архитектуре отдаёт только API. UI идёт через отдельный Vite/React SPA.
// См. docs/ARCHITECTURE.md §4.

import type { ReactNode } from 'react';

export const metadata = {
  title: 'Meal Planner API',
  description: 'REST API + worker entry. UI лежит в отдельном frontend/.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
