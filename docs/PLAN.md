# План реализации

> Документ описывает **последовательность шагов** реализации rework'a.
> Привязан к `ROADMAP.json` (что делать) и `ARCHITECTURE.md` (как делать).
> История уже завершённых фаз — в конце документа в разделе «История фаз».

**Текущая ветка:** `rework/nextjs-postgres`
**Статус:** Phase 0 ✅ DONE, Phase 1 ✅ DONE (обе 2026-05-24). Активная фаза: **Phase 2 (Recipes)** — backend всех 6 фич готов (`scr-edit-rules` backend ✅, осталась только UI-форма `/rules`) + e2e acceptance.

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

## Phase 2 — Recipes

**Цель:** Поднять справочник рецептов с пайплайном «найти → нормализовать → провалидировать». UI-редактор правил питания.

**Включает (feature):**
- [x] `ent-nutrition-rules` — Правила питания (P0) ✅ 2026-05-25 (tag-based: tag_dictionary, nutrition_targets, tag_rules)
- [x] `ent-recipes` — Рецепты (P0) ✅ 2026-05-25 (recipes + recipe_ingredients + recipe_tags + ingredients.tags GIN)
- [x] `scr-search-recipes` — Поиск рецептов (P0) ✅ 2026-05-28 (core/recipes → llm-service POST /jobs+wait → persist is_relevant=true; stub-first, AnthropicAdapter в backlog)
- [x] `scr-normalize-recipe` — Нормализация рецепта (P0) ✅ 2026-05-25 (pg_trgm fuzzy + unit_conversions + totals)
- [x] `scr-validate-recipes` — Валидация рецептов (P0) ✅ 2026-05-25 (tag-based rule engine, §7.3 ARCHITECTURE)
- [~] `scr-edit-rules` — Редактирование правил (P1) — backend ✅ 2026-05-28 (core/rules + REST /api/nutrition-targets, /api/tag-rules[/:id]); UI `/rules` ⏳

**Зависимости:** Phase 1 (нужен каталог ингредиентов для маппинга).

**Acceptance criteria:**
- ✅ Таблицы `tag_dictionary`, `nutrition_targets`, `tag_rules`, `recipes`, `recipe_ingredients`, `recipe_tags` созданы; `ingredients.tags text[]` с GIN индексом
- `scr-search-recipes` через Claude API генерирует N рецептов под профиль и пишет с `is_relevant=true`
- `scr-normalize-recipe` маппит ингредиенты на каталог (fuzzy по name через `pg_trgm`), считает КБЖУ, ставит `is_normalized=true`
- `scr-validate-recipes` проверяет рецепт против `nutrition_rules` + запрещённых продуктов (§13a) и ставит `is_approved=true/false` с `rejection_reasons[]`
- Web UI `/rules` — формы для CRUD правил питания (RHF + Zod + SCSS modules)
- E2E-тест: создать правило → создать рецепт → нормализовать → провалидировать (через API)

**Открытые вопросы:**
- Структура `nutrition_rules`: одна jsonb-колонка или нормализованная схема (отдельные таблицы для allergies, custom_rules)? Обсудить при реализации `ent-nutrition-rules`.
- Источник «N рецептов под профиль» — только Claude API или ещё внешние сайты?

---

## Phase 3 — Plan

**Цель:** Расчёт целевых КБЖУ, остатков, генерация плана недели. Учёт health records (анемия, тренировки) в расчёте норм.

**Включает (feature):**
- [ ] `ent-health-records` — Health records (P1)
- [ ] `scr-import-health` — Выгрузка здоровья (P1)
- [ ] `scr-calc-norms` — Расчёт нормы (P0)
- [ ] `ent-stock` — Остатки (P0)
- [ ] `scr-calc-stock` — Расчёт остатков (P0)
- [ ] `ent-week-plan` — План недели (P0)
- [ ] `scr-calc-week-plan` — Расчёт плана на неделю (P0, hybrid LLM+greedy)

**Зависимости:** Phase 2 (нужны рецепты + правила).

**Acceptance criteria:**
- `scr-calc-norms` возвращает targets КБЖУ на день из профиля + health records + правил
- `scr-calc-stock` считает остатки = последняя инвентаризация ± план ± заказы ± дневник
- `scr-calc-week-plan` генерирует план: Claude API → валидатор → greedy replacement при сбоях
- Web UI `/plan` — просмотр недельного плана (read-only на этой фазе), карточки дней, разбивка по приёмам
- Юнит-тесты на greedy fallback с фикстурами; интеграция-тест на mini-наборе рецептов

**Открытые вопросы:**
- Структура health records: одна таблица с jsonb или несколько (anthropometry, lab_tests, mood_logs, training_logs)?
- Стоимость токенов Claude API на план недели — оценить при первой реализации, кэшировать промпт

---

## Phase 4 — Procurement

**Цель:** Сборка корзины, отправка заказа, история заказов. Diff факт/план для последующей коррекции.

**Включает (feature):**
- [ ] `ent-cart` — Корзина (P0)
- [ ] `scr-assemble-cart` — Сборка корзины (P0)
- [ ] `ent-order-history` — История заказов (P0)
- [ ] `scr-order-products` — Заказ продуктов (P1)

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
- [ ] `ent-food-diary` — Дневник питания (P0)
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

**Фаза:** Phase 2 — Recipes (весь backend готов).
**Следующая итерация (закрытие Phase 2):** Web UI `/rules` — форма CRUD правил питания (RHF + Zod + SCSS modules) поверх готового API (`/api/nutrition-targets`, `/api/tag-rules`). Это закрывает `scr-edit-rules` (→ done) и **всю Phase 2**. Затем (опц.) e2e-acceptance «правило → рецепт → нормализация → валидация через API», перенос Phase 2 в «Историю фаз», старт Phase 3 (Plan).
**Замечание по UI:** это первая web-страница проекта — заодно поднять фронтовый слой (TanStack Query + RHF + api-клиент к backend) по ARCHITECTURE §5.

---

## История фаз

Когда фаза завершается — переносим её сюда с пометкой `✅ DONE` + датой.

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
