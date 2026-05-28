import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite config для Meal Planner SPA.
// UI-кит: Untitled UI React (Tailwind v4 + React Aria) — см. docs/ARCHITECTURE.md §5.
// Проксируем /api/* на backend (Next.js на :3000) при dev — чтобы не возиться с CORS.
// В проде nginx-контейнер перенаправит /api/ к backend-контейнеру.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
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
