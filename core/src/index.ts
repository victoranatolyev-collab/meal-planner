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
  listRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  recipeCreateSchema,
  recipeUpdateSchema,
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
  RecipeCreate,
  RecipeUpdate,
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

// Cart (scr-assemble-cart: план − остатки → корзина по магазинам)
export { assembleCart, getActiveCart, assembleCartLines, assembleCartRequestSchema } from './cart/index.js';
export type {
  AssembleCartResult,
  PlanItemRef,
  RecipeIngredientRef,
  CartLine,
  AssembleCartRequest,
} from './cart/index.js';

// Notifications (scr-notifications: расписания → Apple Reminders CalDAV)
export {
  pushReminders,
  runDailyReminders,
  buildReminderTasks,
  StubReminderAdapter,
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  scheduleCreateSchema,
  scheduleUpdateSchema,
} from './notifications/index.js';
export type {
  PushRemindersResult,
  ScheduleInput,
  ReminderTask,
  ReminderAdapter,
  ScheduleCreate,
  ScheduleUpdate,
} from './notifications/index.js';

// Diary (scr-write-diary: запись факт-приёмов)
export { writeDiaryEntry, listDiary, scaleMacros, diaryEntryCreateSchema } from './diary/index.js';
export type { Macros, DiaryEntryCreate } from './diary/index.js';

// Stock calc (scr-calc-stock: проекция остатков baseline + заказы − дневник)
export { calcStock, projectStock } from './stock/index.js';
export type { CalcStockResult, StockProjectionLine } from './stock/index.js';

// Correction (scr-correct-plan: сверка факт vs план, остаток КБЖУ)
// NB: correction.Macros НЕ ре-экспортируем (коллизия с diary.Macros) — он внутренний.
export { correctPlan, computeCorrection } from './correction/index.js';
export type { CorrectPlanResult, DayCorrection } from './correction/index.js';

// Orders (scr-order-products: корзина → история заказов)
export { placeOrder, listOrders, groupCartIntoOrders, placeOrderRequestSchema } from './orders/index.js';
export type {
  PlaceOrderResult,
  CartItemForOrder,
  OrderDraft,
  PlaceOrderRequest,
} from './orders/index.js';

// Health (scr-import-health: импорт anthropometry/lab_tests/training_logs/mood_logs)
export {
  createAnthropometry,
  listAnthropometry,
  createLabTest,
  listLabTests,
  createTrainingLog,
  listTrainingLogs,
  createMoodLog,
  listMoodLogs,
  HEALTH_KINDS,
  anthropometryCreateSchema,
  labTestCreateSchema,
  trainingLogCreateSchema,
  moodLogCreateSchema,
  healthListQuerySchema,
} from './health/index.js';
export type {
  HealthKind,
  AnthropometryCreate,
  LabTestCreate,
  TrainingLogCreate,
  MoodLogCreate,
  HealthListQuery,
} from './health/index.js';

// Norms (scr-calc-norms: расчёт целевых КБЖУ из anthropometry)
export { calcNorms, calcNormsForUser } from './norms/index.js';
export type { NormsInput, NormsResult, CalcNormsForUserResult } from './norms/index.js';

// Plan (scr-calc-week-plan: генерация плана недели через llm-service + greedy)
export {
  generateWeekPlan,
  getWeekPlan,
  listWeekPlans,
  resolveDraftToApproved,
  calcPlanOutputSchema,
  generateWeekPlanRequestSchema,
  getWeekPlanQuerySchema,
} from './plan/index.js';
export type {
  GenerateWeekPlanArgs,
  GenerateWeekPlanResult,
  ApprovedRecipe,
  ResolvedPlan,
  DraftPlan,
  DraftDay,
  GenerateWeekPlanRequest,
  GetWeekPlanQuery,
} from './plan/index.js';

// Agent (scr-telegram-agent: LLM-агент с tool-use через llm-service agent-reply)
export {
  handleAgentMessage,
  listAgentHistory,
  AGENT_TOOLS,
  toolList,
  agentReplyOutputSchema,
  agentMessageRequestSchema,
} from './agent/index.js';
export type {
  HandleAgentMessageResult,
  AgentToolResult,
  AgentTool,
  AgentReplyOutput,
  AgentMessageRequest,
} from './agent/index.js';

// Telegram (scr-telegram-agent: linking chatId ↔ user + авторизация)
export {
  createLinkToken,
  linkTelegramAccount,
  resolveUserIdByChatId,
  buildStartDeepLink,
  telegramLinkRequestSchema,
} from './telegram/index.js';
export type { TelegramLinkRequest } from './telegram/index.js';
