// Barrel домена rules (scr-edit-rules): CRUD данных правил питания.
// Движок проверки рецептов против правил — в core/src/validation/.
export {
  getNutritionTarget,
  upsertNutritionTarget,
} from './nutrition-target-service.js';
export {
  listTagRules,
  createTagRule,
  updateTagRule,
  deleteTagRule,
} from './tag-rule-service.js';
export { listTags } from './tags-service.js';
export {
  userIdQuerySchema,
  nutritionTargetUpsertSchema,
  tagRuleCreateSchema,
  tagRuleUpdateSchema,
} from './schemas.js';
export type {
  UserIdQuery,
  NutritionTargetUpsert,
  TagRuleCreate,
  TagRuleUpdate,
} from './schemas.js';
