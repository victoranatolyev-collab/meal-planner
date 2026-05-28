// Barrel домена plan (scr-calc-week-plan): генерация недельного плана.
export { generateWeekPlan, getWeekPlan } from './service.js';
export type { GenerateWeekPlanArgs, GenerateWeekPlanResult } from './service.js';
export { resolveDraftToApproved } from './resolve.js';
export type { ApprovedRecipe, ResolvedPlan } from './resolve.js';
export {
  calcPlanOutputSchema,
  generateWeekPlanRequestSchema,
  getWeekPlanQuerySchema,
} from './schemas.js';
export type {
  DraftPlan,
  DraftDay,
  GenerateWeekPlanRequest,
  GetWeekPlanQuery,
} from './schemas.js';
