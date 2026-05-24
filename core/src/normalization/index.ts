// Barrel-экспорт normalization модуля.
export { normalizeRecipe } from './normalizer.js';
export { findBestIngredientMatch } from './fuzzy-match.js';
export {
  convertToGrams,
  convertToGramsWith,
  clearUnitConversionsCache,
} from './unit-conversion.js';
export type {
  RawIngredient,
  MatchedIngredient,
  NormalizationResult,
  MatchConfig,
} from './types.js';
export { DEFAULT_MATCH_CONFIG } from './types.js';
