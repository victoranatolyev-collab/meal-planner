import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Только REST API + worker entry (см. docs/ARCHITECTURE.md §4).
  // Никаких страниц/SSR — фронт идёт отдельным SPA.
  reactStrictMode: true,
};

export default nextConfig;
