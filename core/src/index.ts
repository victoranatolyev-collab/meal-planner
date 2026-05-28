// Barrel-экспорты shared core-библиотеки.
// Импорт из других workspace: `import { prisma, importFiveKa, listIngredients } from 'core'`
// Или адресные subpath-импорты согласно "exports" в package.json:
//   `import { prisma } from 'core/db'`
//   `import { listIngredients } from 'core/ingredients/service'`

export { prisma } from './db.js';
export type { IngredientSource } from '@prisma/client';

// Parsers (stubs of 4 sources; реальные API endpoints — backlog)
export { importFiveKa } from './parsers/five-ka/importer.js';
export type { FiveKaProduct, FiveKaParseResult } from './parsers/five-ka/types.js';
export { importTseh } from './parsers/tseh/importer.js';
export { importLl } from './parsers/ll/importer.js';
export { importVv } from './parsers/vv/importer.js';

// Ingredients
export { listIngredients } from './ingredients/service.js';
export { listIngredientsQuerySchema } from './ingredients/schemas.js';
export type { ListIngredientsQuery } from './ingredients/schemas.js';

// Validation (rule engine)
export { evaluateRules, validateRecipe } from './validation/index.js';
export type {
  IngredientView,
  RuleSnapshot,
  ValidationInput,
  ValidationResult,
} from './validation/index.js';

// Normalization (fuzzy match + unit conversion)
export {
  normalizeRecipe,
  findBestIngredientMatch,
  convertToGrams,
  DEFAULT_MATCH_CONFIG,
} from './normalization/index.js';
export type {
  RawIngredient,
  MatchedIngredient,
  NormalizationResult,
  MatchConfig,
} from './normalization/index.js';

// Recipes (scr-search-recipes: генерация через llm-service + persist)
export {
  searchRecipes,
  buildRecipeCreateInput,
  runLlmJob,
  searchRecipesInputSchema,
  searchRecipesOutputSchema,
  searchRecipesRequestSchema,
  llmRecipeSchema,
  llmRecipeIngredientSchema,
} from './recipes/index.js';
export type {
  SearchRecipesResult,
  SearchRecipesInput,
  SearchRecipesOutput,
  SearchRecipesRequest,
  LlmRecipe,
  LlmRecipeIngredient,
} from './recipes/index.js';

// Rules (scr-edit-rules: CRUD данных правил — tag_rules + nutrition_targets)
export {
  getNutritionTarget,
  upsertNutritionTarget,
  listTagRules,
  createTagRule,
  updateTagRule,
  deleteTagRule,
  userIdQuerySchema,
  nutritionTargetUpsertSchema,
  tagRuleCreateSchema,
  tagRuleUpdateSchema,
} from './rules/index.js';
export type {
  UserIdQuery,
  NutritionTargetUpsert,
  TagRuleCreate,
  TagRuleUpdate,
} from './rules/index.js';

// Users
export { listUsers } from './users/index.js';
