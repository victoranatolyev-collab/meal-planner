#!/usr/bin/env tsx
// Manual smoke-test парсинга 5К.
// Запуск: `npm run seed:5ka --workspace worker`
//   или: `npx tsx worker/src/cli/seed-5ka.ts`
//
// Использует FIVEKA_PARSER_MODE=stub (default) — читает фикстуру вместо реального API.
// Полезно для:
//  - проверить пайплайн целиком (importer → source_5ka → ingredients)
//  - проверить идемпотентность (повторный запуск не дублирует)
//  - наполнить dev-БД для UI-разработки

import { importFiveKa } from 'core';

const start = Date.now();
console.log('[seed-5ka] starting...');

const result = await importFiveKa();

const ms = Date.now() - start;
console.log('[seed-5ka] done:', { ...result, elapsedMs: ms });
process.exit(0);
