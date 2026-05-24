# План реализации

> Документ описывает **последовательность шагов** реализации rework'a.
> Привязан к `ROADMAP.json` (что делать) и `ARCHITECTURE.md` (как делать).
> История уже завершённых фаз — в конце документа в разделе «История фаз».

**Текущая ветка:** `rework/nextjs-postgres`
**Статус:** фазы 0–6 назначены. Активная фаза: **Phase 0 (Foundation)**.

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

## Phase 0 — Foundation

**Цель:** Поднять скелет проекта: docker-compose с 4 контейнерами, Prisma + первая миграция (users + profile), пустые рабочие endpoints backend и точка входа frontend. После фазы — `docker compose up` запускает Postgres + backend + frontend + worker, миграции применяются, `GET /api/health` возвращает 200.

**Включает (feature):**
- [ ] `ent-users` — Пользователи (P0)
- [ ] `ent-profile` — Профиль (P0)

**Не-feature задачи (инфраструктура):**
- [x] Monorepo: корневой `package.json` + npm workspaces, `.nvmrc`
- [x] Backend: `package.json` (Next.js 15, pino, zod), `tsconfig.json` (strict), `next.config.ts`, ESLint 9 flat config + Prettier
- [x] Frontend: `package.json` (Vite 6, React 19, react-router 7), `tsconfig.json` (project references), `vite.config.ts` (с dev-proxy /api→:3000), SCSS modules + design tokens, ESLint 9 + Prettier
- [x] Worker: `package.json` (node-cron, pino, tsx, typescript), `tsconfig.json` (NodeNext ESM strict), `src/index.ts` (heartbeat + graceful shutdown). Prisma подключим вместе с миграцией.
- [ ] Prisma: `schema.prisma` с моделями `User`, `Profile`, первая миграция (закрывает `ent-users` + `ent-profile`)
- [x] `backend/.env.example` (DATABASE_URL, ANTHROPIC_API_KEY, TELEGRAM_*, APPLE_*, LOG_LEVEL)
- [x] `frontend/.env.example` (VITE_API_BASE_URL); worker .env.example — пока пусто
- [x] `worker/.env.example` (DATABASE_URL, ANTHROPIC_API_KEY, APPLE_*, LOG_LEVEL)
- [x] `.gitignore` (`docs/.iteration-plan.md`, `node_modules/`, `.env`, `dist/`, `.next/`, `*.tsbuildinfo`)
- [x] Backend healthcheck endpoint (`GET /api/health`)
- [x] Worker heartbeat (cron + лог) — фактически self-healthcheck (контейнер живой при наличии heartbeat-лога)
- [ ] Frontend healthcheck — позже, в Phase 1 (страница `/` уже отдаётся nginx)
- [ ] `docker-compose.yml`: 4 сервиса (postgres, backend, worker, frontend) с volume для postgres

**Зависимости:** нет.

**Acceptance criteria:**
- `docker compose up` поднимает все 4 контейнера без ошибок
- `psql` показывает миграции применены, таблицы `users` и `profiles` существуют
- `curl http://localhost:3000/api/health` → `200 OK`
- `curl http://localhost:5173/` отдаёт страницу-заглушку frontend
- worker контейнер пишет в лог "worker started" и не падает
- ESLint + TypeScript-typecheck проходят в backend, frontend, worker

**Открытые вопросы:**
- Бэкапы Postgres — отложено до Phase 5
- Auth — отложено (Auth.js v5 появится с 2-м пользователем)

---

## Phase 1 — Catalog

**Цель:** Наполнить БД ингредиентами Пятёрочки через парсер. Заложить структуру источников (4 ent-source-*) и центральный каталог.

**Включает (feature):**
- [ ] `ent-source-5ka` — Выгрузка 5К (P0)
- [ ] `ent-ingredients` — Каталог ингредиентов (P0)
- [ ] `scr-parse-5ka` — Парсинг 5К (P0)
- [ ] `ent-source-tseh` — Выгрузка Цех (P2)
- [ ] `ent-source-ll` — Выгрузка ЛЛ (P2)
- [ ] `ent-source-vv` — Выгрузка ВкусВилл (P2)
- [ ] `scr-parse-tseh` — Парсинг Цех (P2)
- [ ] `scr-parse-ll` — Парсинг ЛЛ (P2)
- [ ] `scr-parse-vv` — Парсинг ВкусВилл (P2)

**Зависимости:** Phase 0.

**Acceptance criteria (фаза закрыта, когда):**
- Миграция добавляет таблицы 4 `source_*` + `ingredients`
- `scr-parse-5ka` запускается из CLI (`pnpm worker:parse:5ka`) и:
  - подключается к источнику Пятёрочки (метод TBD на момент реализации — записать решение в HISTORY.md)
  - обновляет `source_5ka` и `ingredients` (idempotent: повторный запуск не дублирует записи)
  - логирует через pino количество обработанных позиций
- Backend endpoint `GET /api/ingredients` возвращает список из БД (с пагинацией)
- P2-парсеры (Цех/ЛЛ/ВВ) — таблицы и пустые функции-обёртки; реальный парсинг как backlog внутри фазы
- Worker cron триггерит `scr-parse-5ka` по расписанию `Сб 03:00` (включён в docker-compose worker)

**Открытые вопросы:**
- Метод парсинга 5K: API / scraping / iframe / OCR — выбрать при реализации и зафиксировать в HISTORY.md (`docs/ARCHITECTURE.md §8.4`)
- Хранилище сырого ответа источника (raw HTML/JSON) — в БД (jsonb) или в файлах volume?

---

## Phase 2 — Recipes

**Цель:** Поднять справочник рецептов с пайплайном «найти → нормализовать → провалидировать». UI-редактор правил питания.

**Включает (feature):**
- [ ] `ent-nutrition-rules` — Правила питания (P0)
- [ ] `ent-recipes` — Рецепты (P0)
- [ ] `scr-search-recipes` — Поиск рецептов (P0, через Claude API)
- [ ] `scr-normalize-recipe` — Нормализация рецепта (P0)
- [ ] `scr-validate-recipes` — Валидация рецептов (P0)
- [ ] `scr-edit-rules` — Редактирование правил (P1, UI)

**Зависимости:** Phase 1 (нужен каталог ингредиентов для маппинга).

**Acceptance criteria:**
- Таблицы `nutrition_rules`, `recipes`, `recipe_ingredients` (junction) созданы
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

**Фаза:** Phase 0 — Foundation.
**Следующая итерация:** заложить скелет — `docker-compose.yml`, `package.json`-ы, `tsconfig.json`-ы, базовая структура каталогов.

---

## История фаз

Когда фаза завершается — переносим её сюда с пометкой `✅ DONE` + датой.

(пусто)
