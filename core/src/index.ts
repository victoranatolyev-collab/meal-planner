// Barrel-экспорты shared core-библиотеки.
// Импорт из других workspace: `import { prisma, importFiveKa, listIngredients } from 'core'`
// Или адресные subpath-импорты согласно "exports" в package.json:
//   `import { prisma } from 'core/db'`
//   `import { listIngredients } from 'core/ingredients/service'`

export { prisma } from './db.js';
export type { IngredientSource } from '@prisma/client';

// Parsers
export { importFiveKa } from './parsers/five-ka/importer.js';
export type { FiveKaProduct, FiveKaParseResult } from './parsers/five-ka/types.js';

// Ingredients
export { listIngredients } from './ingredients/service.js';
export { listIngredientsQuerySchema } from './ingredients/schemas.js';
export type { ListIngredientsQuery } from './ingredients/schemas.js';
