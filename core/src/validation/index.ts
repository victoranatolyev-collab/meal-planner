// Barrel-экспорт валидатора правил.
export { evaluateRules } from './evaluate-rules.js';
export { validateRecipe } from './recipe-validator.js';
export {
  BAN_KEYWORDS,
  BAN_TAGS,
  ingredientMatchesBan,
  recipeNameMatchesBan,
  deriveBanTags,
} from './ban-keywords.js';
export type { BanSpec } from './ban-keywords.js';
export type {
  IngredientView,
  RuleSnapshot,
  ValidationInput,
  ValidationResult,
} from './types.js';
