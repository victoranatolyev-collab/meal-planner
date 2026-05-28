# PROGRESS — append-only journal Ralph Loop

> Этот файл **append-only**. Ralph Loop добавляет сюда заметки между итерациями.
> AI читает PROGRESS в начале каждой итерации, чтобы помнить, что уже узнал.
>
> Формат: каждая запись — timestamp + iteration id + что узнал/сделал/не получилось.
> Новые записи **снизу** (как git log). Не редактируй старые — только добавляй.

---

## Iteration 0 — 2026-05-25 — Старт Ralph Loop

- Подготовлены документы для Ralph: `AGENTS.md` (knowledge base), `docs/PROGRESS.md` (этот файл), `docs/RALPH_PROMPT.md` (главный промпт цикла), `docs/RALPH_GUIDE.md` (инструкции).
- Состояние: 15/37 фичей done. Активная фаза — Phase 2 (Recipes), осталось 2 фичи (scr-search-recipes, scr-edit-rules).
- Последний коммит: `f92d221` (llm-service skeleton + pg-boss + StubAdapter).
- ROADMAP.json служит как PRD. ROADMAP.json features со status≠done — это "stories to pass".

---

<!-- Ralph: добавляй новые записи ниже этой линии -->

## Iteration 1 — 2026-05-28 — scr-search-recipes

- **Сделал:** `scr-search-recipes` (Phase 2, P0). Новый домен `core/src/recipes/` (schemas + llm-client + mapper + search-service) + backend `POST /api/recipes/search`. Пайплайн: searchRecipes() → llm-service (POST /jobs + /wait) → persist Recipe с is_relevant=true, source=LLM, rawIngredients (форма RawIngredient → handoff в scr-normalize-recipe), recipe_tags из mealTags. 16/37 done.
- **Узнал (gotcha):** `POST /jobs/:id/wait` в llm-service отдавал `404 job_not_found` пока воркер не подхватит job — запись в `llm_jobs` (audit) создаётся **лениво** в handleJob, а не при enqueue. Гонка между enqueue и pickup. Фикс: wait трактует `audit==null` как pending (poll до deadline), не 404. Записал в AGENTS.md gotcha #11.
- **Узнал (паттерн):** core МОЖЕТ ходить в llm-service по HTTP (это не импорт). `runLlmJob<S extends ZodTypeAny>` generic возвращает `z.infer<S>` — важно из-за `.default()`: `ZodSchema<T>` коллапсит Input/Output, ломая тип. Записал gotcha #12.
- **Не делал:** AnthropicAdapter + prompts/search-recipes.ts (инъекция профиля/правил в system prompt) — backlog, нужен ANTHROPIC_API_KEY. Stub-first как у парсеров.
- **Проверки:** vitest 56/56, tsc ×4 ws, eslint ×3 ws, next build, smoke end-to-end (docker pg + llm-service stub) = SMOKE_OK.

## Iteration 2 — 2026-05-28 — scr-edit-rules (backend CRUD)

- **Сделал:** backend-часть `scr-edit-rules` (Phase 2, P1). Новый домен `core/src/rules/` (schemas + nutrition-target-service + tag-rule-service) + REST: GET/PUT /api/nutrition-targets, GET/POST /api/tag-rules, PATCH/DELETE /api/tag-rules/[id]. scr-edit-rules → **in_progress** (UI /rules закроет). 16/37 done без изменений.
- **Решение:** домен `rules/` (управление ДАННЫМИ) ≠ `validation/` (движок проверки). Зафиксировал в barrel. tag_rules Zod superRefine: quantity↔MIN/MAX_PER_WEEK, mealTag↔*_IN_MEAL — реальная доменная валидация, ловится юнит-тестами.
- **Узнал (gotcha):** Next.js 15 — `params` в `app/api/x/[id]/route.ts` это **Promise**, надо `await ctx.params`. Записал AGENTS.md gotcha #13.
- **Узнал:** eslint flat config НЕ игнорит `_`-префикс для unused (нет varsIgnorePattern); не используй `const {x:_unused, ...rest}` для omit в тестах — пиши объект явно.
- **Проверки:** vitest 68/68 (+12), tsc ×3, eslint ×2, next build (3 route), HTTP smoke (next start + curl): upsert target, CRUD tag-rule, 400 на невалидный superRefine, 204/404 на delete — всё ✓.
- **Следующее:** UI `/rules` (RHF+Zod+SCSS+TanStack Query) → закрытие scr-edit-rules + Phase 2. Это первая web-страница — поднять фронтовый слой.

## Iteration 3 — 2026-05-28 — Frontend → Untitled UI React (инфра)

- **Контекст:** на вопросе про first-UI пользователь редиректнул стек: использовать Untitled UI React (Tailwind v4 + React Aria) для всего приложения + их MCP, без хардкода, split /rules на 2.
- **Сделал:** инфра-миграция frontend. MCP `untitledui` в `.mcp.json` (project scope). Vendored kit (base+foundations+utils+hooks+providers = 173 файла) из официального vite-starter-kit. Tailwind v4 + deps. ARCHITECTURE §5/§2.2/§13 переписаны (разрешённое изменение — явная нужда юзера). НЕ фича — статусы ROADMAP без изменений (16/37).
- **Узнал (gotchas):** (1) untitledui CLI не понимает monorepo-layout ("Unsupported project framework") → clone starter + ручной перенос. (2) Untitled UI требует tsconfig: jsx `preserve` (иначе `import React` unused), lib `ESNext` (iterator `.toArray()`); vendored код НЕ проходит `noUncheckedIndexedAccess`/`noImplicitOverride` — убрал для frontend (strict оставил). (3) vendored импортит `@react-aria/utils`/`@react-stately/utils` напрямую — их не было в дереве, доустановил. (4) frontend `typecheck` script был no-op (`tsc --noEmit` при tsconfig files:[]) → `tsc -b`. Записал AGENTS gotchas #16-19.
- **Не проверено:** визуальный рендер (dev-сервер) — только build/typecheck/lint зелёные. MCP-тулы недоступны в этой сессии (нужен reconnect) — добавлены для будущих.
- **Следующее:** /rules — api-клиент + TanStack Query + useCurrentUser + форма nutrition-targets на Untitled UI (iter N+1), потом CRUD tag-rules (iter N+2) → закрыть scr-edit-rules + Phase 2.

## Iteration 4 — 2026-05-28 — /rules шаг 1: data-слой + форма КБЖУ

- **Сделал:** первая web-страница `/rules` + фронтовый data-слой. Backend `GET /api/users`. Frontend: api-клиент (fetch+ApiError), TanStack Query, `useCurrentUser` (первый из /api/users, без хардкода), форма целей КБЖУ (RHF + Controller + Untitled UI InputNumber, prefill useQuery + PUT useMutation). scr-edit-rules остаётся in_progress (шаг 2 = tag-rules CRUD).
- **Узнал (gotchas):** (1) React Aria NumberField пустое = NaN → Zod: required `.finite()`, optional `union([...,z.nan()])` + submit фильтрует `Number.isFinite`. (2) RHF + React Aria = через `Controller` (value/onChange-number), не register. (3) frontend НЕ может импортить core Zod-схемы (core тянет @prisma/client в браузер) → дублируем схему на клиенте. (4) `as typeof body` → `never`; juzaй explicit type alias. (5) zsh `UID` зарезервирована (как `status`). Записал AGENTS gotchas #20-21.
- **Не проверено:** визуал в браузере (build/lint/types зелёные, API смоук-verified).
- **Следующее:** /rules шаг 2 — CRUD tag-rules (список + add/edit/delete на /api/tag-rules) → закрыть scr-edit-rules + Phase 2.

## Iteration 5 — 2026-05-28 — /rules шаг 2: tag-rules CRUD → scr-edit-rules DONE

- **Сделал:** секция CRUD tag-rules на `/rules` (api/tag-rules + tag-rule-schema + tag-rules-section). Список с toggle isActive (PATCH) + delete (DELETE), форма добавления (Untitled UI Select ruleKind + conditional quantity/mealTag, POST). `scr-edit-rules` → **done**. 17/37; все 6 фич Phase 2 закрыты.
- **Узнал:** Untitled UI `Select` = `items` + render `Select.Item`, React Aria `selectedKey`/`onSelectionChange` через RHF Controller. Кнопки-действия — нативный `onClick` (RAC Button v1.16 форвардит; onPress не в типах). Conditional поля формы — через `watch('ruleKind')`.
- **Не проверено:** визуал в браузере (build/lint/types зелёные; backend tag-rules CRUD уже curl-smoke-verified).
- **Следующее:** ЕДИНСТВЕННЫЙ незакрытый Phase-2 acceptance — e2e-тест rule→recipe→normalize→validate через API (integration test). Потом Phase 2 → история, старт Phase 3.

## Iteration 6 — 2026-05-28 — ✅ Phase 2 закрыта (e2e acceptance)

- **Сделал:** `worker/src/cli/e2e-phase2.ts` — integration-смоук всего пайплайна Phase 2 (searchRecipes stub → normalizeRecipe pg_trgm → validateRecipe BAN_TAG). 8 проверок, прогон зелёный против docker pg + llm-service stub. Phase 2 → «История фаз», Активная фаза → **Phase 3**. 17/37.
- **Решение:** e2e = CLI-смоук (паттерн seed-*), не vitest (не тащим БД/llm-service в unit-прогон). core unit-тесты остаются чистыми (68/68).
- **Узнал:** service-функции с Zod `.default()` в схеме имеют output-тип параметра (обязательные defaulted-поля) — прямой вызов без parse требует их явно (createTagRule → isActive).
- **Следующее (Phase 3):** старт. ВАЖНО: открытый вопрос — структура `health_records` (jsonb vs нормализованная) → **AskUserQuestion** перед `ent-health-records`/`scr-calc-norms`. Кандидат на первую задачу: `scr-calc-norms` (P0, чистая функция) или `ent-stock` (P0 entity).

## Iteration 7 — 2026-05-28 — Phase 3 шаг 1: ent-stock

- **Сделал:** миграция `stock` (StockItem: user+ingredient FK, qtyG, unique(user,ingredient) для upsert, Cascade/Restrict). Smoke psql: upsert идемпотентен + FK enforced. `ent-stock` → done. 18/37.
- **Решение:** current-state хранение (1 строка/пара), не ledger; qtyG граммы (как recipe_ingredients). Низкая сложность — без вопросов.
- **Следующее:** `ent-week-plan` (P0 entity, deps готовы): схема week_plans→days→meals→meal_items. Затем ent-health-records (P1, нужен AskUserQuestion по схеме) разблокирует scr-calc-norms.

## Iteration 8 — 2026-05-28 — Phase 3 шаг 2: ent-week-plan

- **Сделал:** миграция `week_plan` — 4 таблицы (WeekPlan→PlanDay→PlanMeal→PlanMealItem) + enum WeekPlanStatus. По AskUserQuestion: точно как legacy (day_type/meal time+tags/from_stock+tail), snapshot targets+budget в план, portionFactor (предрасч. 0.8/1/2, одна ссылка). Smoke: дерево + cascade-delete через 4 уровня OK. `ent-week-plan` → done. 19/37.
- **Узнал (gotcha):** Prisma `String @default(uuid())` → колонка TEXT (не uuid-тип) в postgres. В psql DO-блоках: переменные `text`, `gen_random_uuid()::text`.
- **Следующее:** `ent-health-records` (P1) — РАЗБЛОКИРУЕТ scr-calc-norms (P0). ⚠️ Перед ним **AskUserQuestion**: структура health_records (jsonb vs нормализ.) + какие поля нужны scr-calc-norms (вес/рост/возраст/активность/Hb/ферритин). Альтернатива: scr-calc-week-plan (P0 ready, но самая сложная — нужен calc-plan job в llm-service).

## Iteration 9 — 2026-05-28 — Phase 3 шаг 3: ent-health-records

- **Сделал:** миграция health_records — полная нормализация (AskUserQuestion): 4 append-only таблицы (anthropometry/lab_tests/training_logs/mood_logs) + enums Sex/ActivityLevel/Goal. anthropometry = снимок входов норм (sex/age/height/weight/activity/goal). Все с measured_at + index DESC. Smoke: latest-snapshot OK. `ent-health-records` → done. 20/37. Все entity Phase 3 закрыты.
- **Решение:** нормализация + append-only (тренды важны: вес, Hb-динамика при анемии). authoritative targets остаются в NutritionTarget (через /rules); scr-calc-norms = вычисление-предложение.
- **Следующее:** `scr-calc-norms` (P0, разблокирован) — чистая функция: latest anthropometry → BMR (Mifflin-St Jeor) × activity → kcal → макросы (proteinGPerKgMin из nutrition_targets). Без вопросов (формула стандартная, reference nutrition_norms.json). Скорее всего core/src/norms/ pure + DB-wrapper.
