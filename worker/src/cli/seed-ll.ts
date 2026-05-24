#!/usr/bin/env tsx
// Manual smoke парсинга Люди Любят (stub).
// Запуск: `npm run seed:ll --workspace worker`

import { importLl } from 'core';

const start = Date.now();
console.log('[seed-ll] starting...');
const result = await importLl();
console.log('[seed-ll] done:', { ...result, elapsedMs: Date.now() - start });
process.exit(0);
