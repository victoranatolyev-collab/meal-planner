import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config для Meal Planner SPA.
// Проксируем /api/* на backend (Next.js на :3000) при dev — чтобы не возиться с CORS.
// В проде nginx-контейнер перенаправит /api/ к backend-контейнеру (см. docs/ARCHITECTURE.md §10).

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
