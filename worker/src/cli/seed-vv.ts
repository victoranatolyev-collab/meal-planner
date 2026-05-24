#!/usr/bin/env tsx
// Manual smoke парсинга ВкусВилл (stub).
// Запуск: `npm run seed:vv --workspace worker`

import { importVv } from 'core';

const start = Date.now();
console.log('[seed-vv] starting...');
const result = await importVv();
console.log('[seed-vv] done:', { ...result, elapsedMs: Date.now() - start });
process.exit(0);
