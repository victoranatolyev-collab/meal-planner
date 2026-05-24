#!/usr/bin/env tsx
// Manual smoke парсинга Цех 85 (stub).
// Запуск: `npm run seed:tseh --workspace worker`

import { importTseh } from 'core';

const start = Date.now();
console.log('[seed-tseh] starting...');
const result = await importTseh();
console.log('[seed-tseh] done:', { ...result, elapsedMs: Date.now() - start });
process.exit(0);
