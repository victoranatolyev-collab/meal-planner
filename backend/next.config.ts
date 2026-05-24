import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Только REST API + worker entry (см. docs/ARCHITECTURE.md §4).
  // Никаких страниц/SSR — фронт идёт отдельным SPA.
  reactStrictMode: true,

  // core/ — shared workspace с TypeScript-исходниками. Next.js должен транспилировать его сам.
  transpilePackages: ['core'],

  // core использует NodeNext ESM с .js-расширениями в импортах (TypeScript-конвенция).
  // Без этого webpack ищет физический .js-файл и падает с module-not-found.
  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
