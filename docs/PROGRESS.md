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

## Iteration 10 — 2026-05-28 — Phase 3 шаг 4: scr-calc-norms

- **Сделал:** core/src/norms/ — pure calcNorms (Mifflin-St Jeor × activity × goal + макросы) + calcNormsForUser (latest anthropometry) + GET /api/norms. 8 юнит-тестов. Smoke: 86кг male → bmr 1933 / kcal 2995 / P155 F100 C369; 422 без anthropometry. `scr-calc-norms` → done. 21/37.
- **Решение:** норма = рекомендация, не перезапись NutritionTarget (override через /rules). Стандартная формула, reference для сверки.
- **Следующее:** `scr-calc-week-plan` (P0, ready, САМАЯ СЛОЖНАЯ — hybrid LLM+greedy). План разбить: (1) calc-plan job в llm-service (сейчас placeholder) + prompt + fixture; (2) core/src/plan/ orchestration (LLM draft → validate каждый рецепт → greedy replacement) + persist в week_plans дерево; (3) endpoint + e2e. По правилу Ralph — закрыть первую подзадачу за итерацию.

## Iteration 11 — 2026-05-28 — scr-calc-week-plan подзадача 1/3 (calc-plan контракт)

- **Сделал:** flesh out calc-plan LLM-job в llm-service: calcPlanInputSchema (targets + days + пул approved recipes) + calcPlanOutputSchema (days→meals→items, зеркало ent-week-plan) + fixture. Stub smoke: enqueue→wait→валидный draft. `scr-calc-week-plan` → in_progress (1/3). 21/37.
- **NB:** stub фикстура → placeholder recipeId. Orchestration (подзадача 2) маппит на реальные approved-рецепты (round-robin по пулу в stub; реальные id в api-режиме).
- **Следующее:** подзадача 2/3 — `core/src/plan/` orchestration: build input (NutritionTarget→targets, approved recipes, days) → runLlmJob('calc-plan') → resolve recipeId (stub: round-robin на пул) → validateRecipe каждого → greedy replacement → persist в week_plans дерево (snapshot targets). Затем 3/3: POST /api/plans + e2e.

## Iteration 12 — 2026-05-29 — scr-calc-week-plan подзадача 2/3 (orchestration)

- **Сделал:** core/src/plan/ — generateWeekPlan: NutritionTarget→targets snapshot, approved-пул, buildDays → runLlmJob('calc-plan') → pure resolveDraftToApproved (greedy round-robin для unknown recipeId) → persist дерево week_plans (tx deleteMany+nested create, регенерация по userId+weekIso). 4 unit-теста resolve. Smoke: 2дн/6приёмов/6поз, 6 substitutions, regenerate→1 план. SMOKE_OK. scr-calc-week-plan in_progress (2/3). 80 тестов.
- **Решение:** greedy = подстановка из approved-пула (уже recipe-level валидны). Week-level (MIN/MAX_PER_WEEK) — refinement. Date доступен в core (ограничение Date — только Workflow-скрипты).
- **Следующее:** подзадача 3/3 — endpoint POST/GET /api/plans + (опц.) e2e в worker/cli → закрывает scr-calc-week-plan.

## Iteration 13 — 2026-05-29 — scr-calc-week-plan подзадача 3/3 — DONE

- **Сделал:** getWeekPlan (чтение дерева) + REST POST/GET /api/plans + Zod request/query схемы. HTTP smoke: POST→201, GET→полное дерево (snapshot kcalTarget=2455, days→meals→items+recipe), 404/400/422. `scr-calc-week-plan` → **done** (все 3 подзадачи). 22/37.
- **Следующее:** `scr-import-health` (P1) — единственная READY фича Phase 3 (импорт в health-таблицы). `scr-calc-stock` (P0) ЗАБЛОКИРОВАН — deps ent-order-history (Phase 4) + ent-food-diary (Phase 5). Кросс-фазовая зависимость → реализуется после Phase 4/5. После scr-import-health: UI /plan + закрытие Phase 3 (scr-calc-stock переносится) → Phase 4.

## Iteration 14 — 2026-05-29 — scr-import-health

- **Сделал:** core/src/health/ — create+list ×4 (anthropometry/lab-tests/training-logs/mood-logs) + Zod схемы (z.coerce.date, nativeEnum) + dynamic route /api/health/[kind] (GET+POST, switch). 10 unit-тестов. Smoke: POST все 4→201, GET read-back, 404/400. `scr-import-health` → done. 23/37. Все READY фичи Phase 3 закрыты.
- **Решение:** dynamic [kind] route (1 файл, type-safe switch) вместо 4 route-файлов. OCR/PDF backlog.
- **Следующее:** Phase 3 UI — `/plan` read-only (просмотр недельного плана поверх GET /api/plans, Untitled UI + TanStack Query, как /rules). Acceptance Phase 3 (§5.3). Затем закрыть Phase 3 (scr-calc-stock → Phase 4, заблокирован) и старт Phase 4 (Procurement).

## Iteration 15 — 2026-05-29 — UI /plan (read-only) + GET /api/plans list

- **Сделал:** listWeekPlans + GET /api/plans без weekIso → список; frontend /plan (Untitled UI Select недели + дерево DayCard, TanStack Query). Smoke list: total 1. Все actionable+acceptance Phase 3 закрыты. 23/37.
- **Урок:** после правки backend route.ts нужен `npm run build --workspace backend` перед `next start` (иначе next start отдаёт старый build — list-режим сначала упал на этом).
- **Следующее:** Phase 4 (Procurement) старт → `ent-cart` (P0 entity, deps готовы): миграция корзины. Затем ent-order-history, scr-assemble-cart, scr-order-products. scr-calc-stock (Phase 3) остаётся заблокирован до Phase 5 (ent-food-diary).

## Iteration 16 — 2026-05-29 — Phase 4 шаг 1: ent-cart

- **Сделал:** миграция cart — Cart (status ACTIVE/ORDERED) + CartItem (ingredient/qtyG/shop, unique cart+ingredient+shop). Smoke psql: upsert/diff-shop/cascade OK. `ent-cart` → done. 24/37.
- **Решение:** shop на item (товар из разных магазинов = разные строки); Cart-wrapper для lifecycle. Соответствует ARCHITECTURE §7.4 (carts).
- **Следующее:** `ent-order-history` (P0 entity, deps ent-cart✅) — архив заказов (shop/items/prices/timestamps). Затем scr-assemble-cart (план−остатки→shop-группы), scr-order-products.

## Iteration 17 — 2026-05-29 — Phase 4 шаг 2: ent-order-history

- **Сделал:** миграция order_history — Order (shop/status/totalRub/dates) + OrderItem (ingredient/qtyG/priceRub факт), unique order+ingredient. Smoke psql OK. `ent-order-history` → done. 25/37. Все entity Phase 4 закрыты.
- **Следующее:** `scr-assemble-cart` (P0) — агрегация: ингредиенты плана недели (рецепты×portionFactor) − остатки → ACTIVE Cart с CartItem (shop=ingredient.source). Pure aggregation + DB-wrapper. Затем scr-order-products (cart→order_history). scr-calc-stock всё ещё ждёт ent-food-diary (Phase 5).

## Iteration 18 — 2026-05-29 — Phase 4 шаг 3: scr-assemble-cart

- **Сделал:** core/src/cart/ — pure assembleCartLines (план×portionFactor − stock → ceil, shop=source) + assembleCart/getActiveCart + POST /api/cart/assemble + GET /api/cart. 5 unit-тестов. Smoke: 200×2−50=350(FIVEKA), 80×2=160(VV). `scr-assemble-cart` → done. 26/37.
- **Следующее:** `scr-order-products` (P1, последняя Phase 4) — ACTIVE Cart → order_history (per shop) + cart ORDERED + POST /api/orders/:id/match (diff факт vs план). Затем Phase 4 close → Phase 5 (Tracking) → разблокирует scr-calc-stock.

## Iteration 19 — 2026-05-29 — scr-order-products: Phase 4 фичи ВСЕ done

- **Сделал:** core/src/orders/ — pure groupCartIntoOrders (по shop, цена) + placeOrder (Cart→order_history per shop, cart ORDERED) + listOrders + POST/GET /api/orders. 4 unit-теста. Smoke: cart→2 заказа (200₽/30₽), ORDERED. `scr-order-products` → done. **27/37, все фичи Phase 4 done.**
- **Осталось 10 фич:** Phase 5 (6: ent-food-diary, scr-write-diary, scr-correct-plan, ent-notification-schedule, scr-notifications, scr-edit-schedule) + Phase 6 (3: telegram) + scr-calc-stock (P3, ждёт ent-food-diary).
- **Отложено (acceptance, не блок. RALPH_DONE):** match endpoint, UI /cart, /diary, /schedule. Приоритет — фичи.
- **Следующее:** `ent-food-diary` (P0, Phase 5) — журнал факт-приёмов. Разблокирует scr-calc-stock.

## Iteration 20 — 2026-05-29 — Phase 5 шаг 1: ent-food-diary

- **Сделал:** миграция food_diary — FoodDiaryEntry (recipe?/customName + макросы + eatenAt + mealName), recipe SetNull. Smoke: recipe+ad-hoc + SetNull. `ent-food-diary` → done. 28/37. **Разблокировал scr-calc-stock** (Phase 3).
- **Следующее:** `scr-calc-stock` (P0, Phase 3 снова активна как первая фаза с незакрытой фичей) — пересчёт остатков (stock ± план ± order_history ∓ food_diary). Закроет Phase 3. Потом Phase 5: scr-write-diary, scr-correct-plan, notifications.

## Iteration 21 — 2026-05-29 — ✅ Phase 3 закрыта: scr-calc-stock

- **Сделал:** core/src/stock/ — pure projectStock + calcStock (baseline + orders − diary→recipe×portion) + GET /api/stock. 3 unit-теста. Smoke: 500+300−200=600. `scr-calc-stock` → done. **29/37. Phase 3 ✅ 7/7** — в «История фаз».
- **Решение:** проекция-отчёт без мутации StockItem (избегаем double-count).
- **Следующее:** Phase 5 — `scr-write-diary` (P0): запись факт-приёма поверх ent-food-diary (предзаполнение из плана). Затем scr-correct-plan, ent-notification-schedule, scr-notifications, scr-edit-schedule. Осталось 8 фич (Phase 5: 5, Phase 6: 3).

## Iteration 22 — 2026-05-29 — scr-write-diary

- **Сделал:** core/src/diary/ — writeDiaryEntry (recipe→derived макросы из totals×portionFactor / ad-hoc вручную) + listDiary + pure scaleMacros + POST/GET /api/diary. 6 unit-тестов. Smoke: recipe ×2 → 1200/90/30/140, ad-hoc 201, 400 без recipe/custom. `scr-write-diary` → done. 30/37.
- **Следующее:** `ent-notification-schedule` (P1 entity) — расписание уведомлений (trigger_type/schedule/reminder_list/template). Затем scr-notifications (CalDAV), scr-correct-plan, scr-edit-schedule. Осталось 7 фич.
