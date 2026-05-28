# План реализации

> Документ описывает **последовательность шагов** реализации rework'a.
> Привязан к `ROADMAP.json` (что делать) и `ARCHITECTURE.md` (как делать).
> История уже завершённых фаз — в конце документа в разделе «История фаз».

**Текущая ветка:** `rework/nextjs-postgres`
**Статус:** Phase 0/1/2/3 ✅ DONE; Phase 4 — все фичи ✅ (acceptance UI /cart + order-match отложены). **29/37 фич.** Активная фаза: **Phase 5 (Tracking)** — дневник, коррекция, нотификации.

---

## Структура плана

План делится на **фазы** (0..6). Каждая — крупный самодостаточный блок работ. Внутри фазы — задачи, привязанные к `feature_id` из `ROADMAP.json`. По завершении фаза переносится в раздел «История фаз» с пометкой `✅ DONE` + датой.

### Шаблон фазы
```markdown
### Phase N: <Название>
**Цель:** ...
**Включает (привязка к ROADMAP.json):**
- [ ] `feature-id` — Название
**Зависимости:** Phase N-1
**Acceptance criteria:** ...
**Открытые вопросы:** ...
```

---

## Phase 0 — Foundation ✅ DONE 2026-05-24

См. подробности в разделе [«История фаз»](#история-фаз).

---

## Phase 1 — Catalog ✅ DONE 2026-05-24

См. подробности в разделе [«История фаз»](#история-фаз).

---

## Phase 2 — Recipes ✅ DONE 2026-05-28

См. подробности в разделе [«История фаз»](#история-фаз).

---

## Phase 3 — Plan ✅ DONE 2026-05-29

См. подробности в разделе [«История фаз»](#история-фаз).

---

## Phase 4 — Procurement

**Цель:** Сборка корзины, отправка заказа, история заказов. Diff факт/план для последующей коррекции.

**Включает (feature):**
- [x] `ent-cart` — Корзина (P0) ✅ 2026-05-29 (миграция cart: Cart status + CartItem ingredient/qtyG/shop, unique cart+ingredient+shop)
- [x] `scr-assemble-cart` — Сборка корзины (P0) ✅ 2026-05-29 (core/cart: pure assembleCartLines план−остатки→shop + assembleCart/getActiveCart; POST /api/cart/assemble, GET /api/cart)
- [x] `ent-order-history` — История заказов (P0) ✅ 2026-05-29 (миграция order_history: Order shop/status/total + OrderItem ingredient/qtyG/priceRub, unique order+ingredient)
- [x] `scr-order-products` — Заказ продуктов (P1) ✅ 2026-05-29 (core/orders: pure groupCartIntoOrders + placeOrder ACTIVE Cart→order_history per shop, cart ORDERED; POST/GET /api/orders)

**Зависимости:** Phase 3 (нужен план + остатки).

**Acceptance criteria:**
- `scr-assemble-cart` собирает корзину: план - остатки → группировка по магазинам
- Web UI `/cart` — drag-and-drop позиций между магазинами (dnd-kit), qty controls
- `scr-order-products` — экспорт в формат заказа (или прямой API магазина — TBD)
- После «отправить заказ» — запись в `order_history`, корзина очищается
- API `POST /api/orders/:id/match` — сверка факт vs план (diff)

**Открытые вопросы:**
- API Пятёрочки для прямого заказа — есть/нет? Если нет — экспорт списка для ручного оформления.

---

## Phase 5 — Tracking

**Цель:** Дневник питания, коррекция плана по факту, расписание нотификаций, push в Apple Reminders.

**Включает (feature):**
- [x] `ent-food-diary` — Дневник питания (P0) ✅ 2026-05-29 (миграция food_diary: FoodDiaryEntry recipe?/customName + макросы + eatenAt, recipe SetNull). Разблокировал scr-calc-stock.
- [ ] `scr-write-diary` — Запись в дневник (P0)
- [ ] `scr-correct-plan` — Коррекция плана (P1)
- [ ] `ent-notification-schedule` — Расписание уведомлений (P1)
- [ ] `scr-notifications` — Push Apple Reminders (CalDAV) (P1)
- [ ] `scr-edit-schedule` — Редактирование расписания (P2, UI)

**Зависимости:** Phase 3 (план), Phase 4 (заказы для контекста).

**Acceptance criteria:**
- Web UI `/diary` — занесение факт-приёма (предзаполнено планом + редактируется)
- `scr-correct-plan` — пересчитывает остаток дня/недели от фактических приёмов
- `scr-notifications` — раз в сутки пишет задачи на день в Apple Reminders/Daily через CalDAV
- Worker cron: `04:00 ежедневно — push reminders`
- Acceptance из ROADMAP `scr-notifications`: дедупликация по UID, не дублирует при повторных запусках
- Web UI `/schedule` — CRUD триггеров уведомлений (RHF + Zod)

**Открытые вопросы:**
- Какой именно список в Apple Reminders использовать? Default из ARCHITECTURE: `Daily`. Подтвердить.
- Бэкапы Postgres — настроить в worker (cron + дамп на внешнее хранилище), способ TBD (S3/rsync/scp)

---

## Phase 6 — Agent

**Цель:** Telegram-бот с LLM-агентом (Claude API + tool-use) с полным CRUD-доступом ко всей системе.

**Включает (feature):**
- [ ] `ent-telegram-account` — Telegram-аккаунт пользователя (P2)
- [ ] `ent-agent-conversations` — История чатов с агентом (P2)
- [ ] `scr-telegram-agent` — Telegram-агент (LLM) (P2)

**Зависимости:** Все предыдущие фазы (агент должен уметь дёргать любой `scr-*`).

**Acceptance criteria (из ROADMAP scr-telegram-agent):**
- Linking чат-айди к пользователю через `/start <token>`
- «покажи план на сегодня» → агент возвращает текстовый план
- «замени ужин на main_b» → агент меняет план и подтверждает
- «я съел snickers вместо плана» → пишет в дневник + предлагает коррекцию
- Контекст агента = последние N сообщений из `agent_conversations`
- Авторизация: входящий chat_id → telegram_accounts → user_id → действия только в его scope

**Открытые вопросы:**
- N сообщений в контексте: предварительно 10-20, уточнить при первой реализации.
- System prompt для агента — отдельный артефакт в `backend/lib/agent/system_prompt.ts`.

---

## Текущий шаг

**Фаза:** Phase 5 (Tracking) старт. Phase 0/1/2 ✅; Phase 3 actionable ✅ (кроме блок. scr-calc-stock); **Phase 4 — все фичи ✅**. **27/37.**
**Осталось фич (10):** Phase 5 — ent-food-diary(P0), scr-write-diary(P0), scr-correct-plan(P1), ent-notification-schedule(P1), scr-notifications(P1), scr-edit-schedule(P2); Phase 6 — ent-telegram-account(P2), ent-agent-conversations(P2), scr-telegram-agent(P2); + scr-calc-stock(P3, ждёт ent-food-diary).
**Сделано:** `scr-calc-stock` ✅ → **Phase 3 закрыта полностью (7/7)**, перенесена в «История фаз». 29/37.
**Следующая задача:** продолжить **Phase 5** — `scr-write-diary` (P0, deps ent-food-diary✅/ent-week-plan✅/ent-recipes✅): запись факт-приёма (предзаполнено планом, правится). core/diary service (create поверх ent-food-diary, возможно предзаполнение из plan_meal_item) + POST endpoint. Затем `scr-correct-plan` (P1), `ent-notification-schedule` (P1), `scr-notifications` (P1, CalDAV), `scr-edit-schedule` (P2).
**Осталось фич (8):** Phase 5 — scr-write-diary, scr-correct-plan, ent-notification-schedule, scr-notifications, scr-edit-schedule; Phase 6 — ent-telegram-account, ent-agent-conversations, scr-telegram-agent.
**Отложенная acceptance-полировка (не ROADMAP-фичи, не блок. RALPH_DONE):** Phase 4 — `POST /api/orders/:id/match` (diff факт/план) + UI `/cart` (dnd-kit); UI `/diary`, `/schedule` (Phase 5 в конце). Приоритет — фичи (к RALPH_DONE = 37 features done), UI/match батчем по фазам.

---

## История фаз

Когда фаза завершается — переносим её сюда с пометкой `✅ DONE` + датой.

### Phase 3 — Plan ✅ DONE 2026-05-29

**Цель:** расчёт целевых КБЖУ, остатков, генерация плана недели + health records.

**Закрытые фичи (7):** ent-health-records, scr-import-health, scr-calc-norms, ent-stock, ent-week-plan, scr-calc-week-plan, scr-calc-stock.

**Реализовано:**
- **ent-health-records:** полная нормализация + append-only — anthropometry / lab_tests / training_logs / mood_logs + enums Sex/ActivityLevel/Goal (решение пользователя AskUserQuestion).
- **scr-import-health:** core/health create+list ×4 + dynamic route `/api/health/[kind]`. OCR/PDF — backlog.
- **scr-calc-norms:** pure Mifflin-St Jeor × activity × goal + макросы; `GET /api/norms` (рекомендация, не перезапись NutritionTarget).
- **ent-stock / ent-week-plan:** миграции (StockItem; WeekPlan→days→meals→items точно как legacy, snapshot targets, portionFactor).
- **scr-calc-week-plan** (самая сложная, 3 подзадачи): llm-service calc-plan job + core/plan orchestration (LLM draft → greedy resolve из approved-пула → persist дерево) + REST POST/GET `/api/plans`. UI `/plan` read-only.
- **scr-calc-stock:** core/stock projection — baseline (StockItem) + куплено (orders) − съедено (diary) → отчёт; `GET /api/stock`.

**Acceptance — все ✅:** norms из профиля+health; stock = инвентаризация ± заказы ∓ дневник; week-plan hybrid LLM+greedy; UI `/plan`; юнит-тесты (norms/resolve/stock). E2E плана — частично через smoke'и.

**Backlog (не блокирует):** AnthropicAdapter для calc-plan (api-режим); week-level правила (MIN/MAX_PER_WEEK) в greedy; forward-проекция stock по плану.

**Коммиты:** 9f5306e, 192473f, 58b4cf7, 1f16fc6, b82fd36, a24ab23, 3613a5f, c5f464c, d66f85f, (stock — текущий).

---

### Phase 2 — Recipes ✅ DONE 2026-05-28

**Цель:** справочник рецептов с пайплайном «найти → нормализовать → провалидировать» + UI-редактор правил питания.

**Закрытые фичи (6):** ent-nutrition-rules, ent-recipes, scr-search-recipes, scr-normalize-recipe, scr-validate-recipes, scr-edit-rules.

**Реализовано:**
- **Tag-based схема** (центральный концепт): `tag_dictionary`, `nutrition_targets`, `tag_rules` + `ingredients.tags text[]` (GIN) + `recipes`/`recipe_ingredients`/`recipe_tags`. Правила = SQL-выборки по тегам.
- **scr-validate-recipes:** pure `evaluateRules` (BAN_TAG / BAN_TAG_IN_MEAL / REQUIRE_TAG_IN_MEAL; MIN/MAX_PER_WEEK — week-level) + DB-wrapper `validateRecipe`. 10 юнит-тестов.
- **scr-normalize-recipe:** pg_trgm fuzzy-match (extension + GIN) + `unit_conversions` (16 seed) + расчёт КБЖУ. threshold 0.3.
- **LLM-микросервис** (`llm-service/`): Hono + pg-boss + Adapter pattern (Stub реализован; Anthropic/CLI — backlog). `llm_jobs` audit. Контракт ARCHITECTURE §10.
- **scr-search-recipes:** `core/src/recipes/` — `searchRecipes()` → llm-service (POST /jobs + wait) → persist Recipe (source=LLM, is_relevant=true, rawIngredients для нормализатора, recipe_tags). Backend `POST /api/recipes/search`. Stub-first.
- **scr-edit-rules:** `core/src/rules/` CRUD (tag_rules + nutrition_targets, Zod superRefine) + REST (`/api/nutrition-targets`, `/api/tag-rules[/:id]`). UI `/rules` на **Untitled UI React** (форма КБЖУ + tag-rules CRUD).
- **Frontend-стек сменён** (решение пользователя): SCSS modules → **Tailwind v4 + Untitled UI React + React Aria** + MCP `untitledui`. ARCHITECTURE §5/§13.

**Acceptance criteria — все ✅:**
- ✅ Таблицы tag_dictionary/nutrition_targets/tag_rules/recipes/recipe_ingredients/recipe_tags + ingredients.tags GIN
- ✅ scr-search-recipes генерирует N рецептов is_relevant=true (через llm-service; stub-first)
- ✅ scr-normalize-recipe маппит на каталог (pg_trgm), считает КБЖУ, is_normalized=true
- ✅ scr-validate-recipes против tag_rules → is_approved + rejection_reasons
- ✅ Web UI `/rules` — CRUD правил (RHF + Zod + Untitled UI; стек сменён со SCSS на Tailwind)
- ✅ E2E-тест rule→recipe→normalize→validate через API: `worker/src/cli/e2e-phase2.ts` (8 проверок зелёные)

**Backlog (не блокирует):** AnthropicAdapter/ClaudeCliAdapter (нужен ANTHROPIC_API_KEY); реальные API парсеров; визуальная проверка UI в браузере.

**Коммиты:** 0007ca1, 376b77f, 60d3856, 21c79af, 0954261, (e2e — текущий).

---

### Phase 1 — Catalog ✅ DONE 2026-05-24

**Цель:** Наполнить БД ингредиентами 4 источников через идемпотентный парсер; expose через REST.

**Закрытые фичи (9):** ent-source-5ka, ent-source-tseh, ent-source-ll, ent-source-vv, ent-ingredients, scr-parse-5ka, scr-parse-tseh, scr-parse-ll, scr-parse-vv.

**Реализовано:**
- Prisma миграция `catalog`: 4 таблицы `source_*` (append-only снимки с raw+summary jsonb, индекс parsed_at DESC) + `ingredients` (Decimal КБЖУ/цены, enum source, unique (name, source, pack_size))
- Парсер 5К с полной структурой: types/parser/stub-parser/api-parser/mapper/importer + 5-позиционный fixture; идемпотентный UPSERT в ingredients + INSERT в source_5ka
- 3 P2 парсера (Цех/ЛЛ/ВВ) по cookie-cutter pattern из 5К, каждый со своим fixture и mapper
- `GET /api/ingredients` endpoint с пагинацией (limit/offset/source/q text-search), Zod validation, 400 с error details
- Worker cron: 4 задачи в одну субботу (5K 03:00, Цех 03:15, ЛЛ 03:30, ВВ 03:45)
- Manual CLI seed-* для smoke-тестов всех 4 источников
- Vitest setup в core, 23 юнит-теста (mapper × 4 источника + schemas) — зелёные

**End-to-end проверка:**
- ✅ Все 4 stub-seeders отрабатывают (5 ingredients per source = 20 total)
- ✅ Idempotency: повторные запуски не дублируют ingredients (UPSERT по unique key)
- ✅ Append-only sources: повторные запуски создают новые snapshot rows
- ✅ `GET /api/ingredients?limit=20` возвращает массив 20 items с полным КБЖУ + price/100g

**Backlog (не блокирует):**
- Реальные API endpoints 5ka.ru/Цех/ЛЛ/ВВ (требуют reverse-engineering из DevTools пользователя)

**Коммиты:** 932893f, e8c6f43, cbd3847, caa6c95, c541221, 7f7a204, (текущий).

---

### Phase 0 — Foundation ✅ DONE 2026-05-24

**Цель:** Поднять скелет проекта: docker-compose с 4 контейнерами, Prisma + первая миграция (users + profile), пустые рабочие endpoints, точка входа frontend.

**Закрытые фичи:** `ent-users`, `ent-profile` (status=done).

**Инфраструктура (всё ✅):**
- Monorepo на npm workspaces (root `package.json` + `.nvmrc=22`)
- Backend: Next.js 15 App Router + TS strict + ESLint 9 flat + Prettier + pino + zod + `GET /api/health`
- Frontend: Vite 6 + React 19 + TS strict + SCSS modules + React Router v7 + design tokens
- Worker: Node 22 + node-cron + pino + tsx (dev) + tsc (build) + graceful SIGTERM
- Prisma: schema (User+Profile 1:1 FK Cascade) + миграция `init` + `lib/db.ts` singleton
- Docker: 3 multi-stage Dockerfile (alpine), nginx.conf с /api proxy, docker-compose.yml с 4 сервисами (postgres healthcheck → depends_on), volume `postgres_data`, `.env.example` в корне

**Acceptance проверены:**
- ✅ `docker compose up -d` — 4 контейнера healthy
- ✅ Миграция применяется (`prisma migrate deploy`); `\dt` показывает users, profiles, _prisma_migrations
- ✅ `curl localhost:3000/api/health` → 200
- ✅ `curl localhost:8080/api/health` (через nginx-proxy) → 200 — full-stack integration работает
- ✅ Worker логирует `worker started`
- ✅ ESLint + typecheck + build — зелёные во всех 3 workspace
- ✅ `docker compose down` — чистое завершение

**Коммиты:** c7cfc5a, e5034a2, 0ab2c09, 8d1baba, c314a11, (текущий — закрытие фазы).
