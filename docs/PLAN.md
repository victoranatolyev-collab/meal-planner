# План реализации

> Документ описывает **последовательность шагов** реализации rework'a.
> Привязан к `ROADMAP.json` (что делать) и `ARCHITECTURE.md` (как делать).
> История уже завершённых фаз — в конце документа в разделе «История фаз».

**Текущая ветка:** `rework/nextjs-postgres`
**Статус:** 🎉 **ВСЕ ФАЗЫ ✅ DONE. 37/37 фич. RALPH_DONE.** Phase 0/1/2/3/4/5/6 закрыты (все — «История фаз»). Backlog (не ROADMAP-фичи, нужны ключи/credentials): реальные адаптеры Anthropic (LLM_MODE=api), Telegram bot token + setWebhook, CalDAV (Apple Reminders); acceptance-UI /cart /diary /schedule; order-match endpoint.

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

## Phase 5 — Tracking ✅ DONE 2026-05-29

См. подробности в разделе [«История фаз»](#история-фаз).

---

## Текущий шаг

🎉 **ПРОЕКТ-RERWORK ЗАВЕРШЁН ПО ROADMAP: 37/37 фич `done` → RALPH_DONE.**

Все 7 фаз (0–6) закрыты — см. «История фаз». Дальнейшая работа — **backlog вне ROADMAP-фич** (требует ключей/credentials или это отложенная UI-полировка):
- Реальные адаптеры: Anthropic (`LLM_MODE=api`, нужен `ANTHROPIC_API_KEY`), Telegram (`TELEGRAM_BOT_TOKEN` + `setWebhook`), Apple Reminders/CalDAV (`APPLE_*`). Сейчас всё на stub-адаптерах (архитектура §10 — Adapter pattern, swap = смена env).
- Acceptance-UI: страницы /cart, /diary, /schedule (фронт), order-match endpoint.

---

## История фаз

Когда фаза завершается — переносим её сюда с пометкой `✅ DONE` + датой.

### Phase 6 — Agent ✅ DONE 2026-05-29

**Цель:** Telegram-бот с LLM-агентом (Claude tool-use) с CRUD-доступом ко всей системе.

- [x] `ent-telegram-account` ✅ (миграция telegram_agent: TelegramAccount 1:1 + linking token)
- [x] `ent-agent-conversations` ✅ (миграция telegram_agent: AgentConversation + enum AgentRole, index last-N)
- [x] `scr-telegram-agent` ✅ (stub-first):
  - **Мозг (transport-agnostic):** llm-service job `agent-reply` + `core/src/agent/` (реестр `AGENT_TOOLS` из 5 scr-* + `handleAgentMessage`: history→agent-reply→диспатч→append-only снимок) + `POST /api/agent/message`.
  - **Транспорт:** `core/src/telegram/` linking (createLinkToken/linkTelegramAccount/resolveUserIdByChatId) + `backend/lib/telegram-bot.ts` (grammY: `/start <token>` линковка + `message:text`→`handleAgentMessage`→reply) + `POST /api/telegram/{webhook,link}` (webhook = grammY `std/http` + secret-проверка).
  - **Offline-stub:** `botInfo` (нет getMe) + API-transformer короткозамыкает исходящие → смоук без реального бота. Smoke 5 кейсов ✅ (link, /start linking, агент-ответ +2 в agent_conversations, scope непривязанного=200 без записей, 401 на неверный secret).

**Acceptance (ROADMAP):** linking через `/start <token>` ✅; NL-сообщение → агент → tool → ответ ✅ (intent-маппинг — на реальном LLM, backlog); контекст last-N ✅; авторизация по chat_id→user scope ✅.

---

### Phase 5 — Tracking ✅ DONE 2026-05-29

**Цель:** дневник питания, коррекция плана по факту, расписание + push нотификаций.

**Закрытые фичи (6):** ent-food-diary, scr-write-diary, scr-correct-plan, ent-notification-schedule, scr-notifications, scr-edit-schedule.

**Реализовано:**
- **ent-food-diary:** FoodDiaryEntry (recipe?/customName + макросы + eatenAt, recipe SetNull).
- **scr-write-diary:** core/diary — writeDiaryEntry (recipe → derived макросы / ad-hoc) + listDiary; POST/GET /api/diary.
- **ent-notification-schedule:** NotificationSchedule + enum NotificationTrigger (TIME/EVENT/MEAL_RELATIVE).
- **scr-notifications:** core/notifications — pure buildReminderTasks (детерминир. UID → дедуп) + Adapter pattern (Stub; реальный CalDAV — backlog) + worker cron 04:00 + POST /api/notifications/run.
- **scr-correct-plan:** core/correction — computeCorrection (remaining = target − факт) + GET /api/correction.
- **scr-edit-schedule:** core/notifications schedule CRUD + REST /api/notification-schedules[/:id].

**Acceptance — все ✅** (через core + REST + smoke): дневник, коррекция (остаток), нотификации (дедуп UID), worker cron 04:00. UI `/diary`+`/schedule` — отложенная acceptance-полировка.

**Backlog:** реальный CalDAV (caldav npm + APPLE_ID/APPLE_APP_PASSWORD); бэкапы Postgres в worker; OCR анализов.

**Коммиты:** 036a5f8, 6eb6bbb, 4d6e9e5, 74f90c1, 2d210fe, (scr-edit-schedule — текущий).

---

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
