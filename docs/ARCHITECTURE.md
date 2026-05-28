# Архитектура приложения

> **Документ-контракт.** Это целевая архитектура системы.
> Все реализации должны ей соответствовать. Меняется только при крайней необходимости с записью в `HISTORY.md`.
>
> Связанные документы:
> - `ROADMAP.json` — что делать
> - `PLAN.md` — когда и в каком порядке
> - `HISTORY.md` — что уже было

---

## Содержание

1. [Обзор](#1-обзор)
2. [Стек](#2-стек)
3. [Высокоуровневая схема](#3-высокоуровневая-схема)
4. [Backend (Next.js)](#4-backend-nextjs)
5. [Frontend (Vite + React)](#5-frontend-vite--react)
6. [Worker (cron + долгие задачи)](#6-worker-cron--долгие-задачи)
7. [База данных](#7-база-данных)
8. [Внешние интеграции](#8-внешние-интеграции)
9. [LLM-агент в Telegram](#9-llm-агент-в-telegram)
10. [Деплой](#10-деплой)
11. [Конвенции](#11-конвенции)
12. [Структура репозитория](#12-структура-репозитория)
13. [История изменений архитектуры](#13-история-изменений-архитектуры)

---

## 1. Обзор

Веб-сервис автоматизированного планирования питания с LLM-агентом для одного (расширяемо до нескольких) пользователя.

**Три канала взаимодействия с пользователем:**

- **Веб-интерфейс** — основной UI: дашборд недели, CRUD рецептов/правил/дневника, drag-and-drop в плане
- **Telegram-бот** — natural-language агент с полным tool-use доступом ко всем функциям (через Claude API)
- **Apple Reminders** — time-based нотификации (через CalDAV)

**Контекст:** рерайт существующего Python-CLI приложения (ветка `main`) на полноценный веб-сервис с разделёнными бекендом и фронтендом.

---

## 2. Стек

### 2.1 Backend (Next.js)

| Слой | Технология | Заметки |
|---|---|---|
| Runtime | Node.js LTS | |
| Framework | Next.js (App Router) | **Только backend** — REST API + worker. Никаких страниц/Server Components UI. |
| Язык | TypeScript | strict mode |
| API style | REST через Route Handlers (`app/api/*`) | |
| ORM | **Prisma** | Выбран как наиболее зрелый. Альтернатива Drizzle рассмотрена и отклонена (менее polished миграции на сейчас). |
| DB | PostgreSQL 16+ | |
| Валидация | Zod | request bodies, env, tool definitions для агента |
| LLM | `@anthropic-ai/sdk` (Anthropic Claude API) | Для агента и поиска рецептов |
| Telegram bot | grammY | TypeScript-first, активный |
| CalDAV | `caldav` (npm) | Apple Reminders push |
| Logging | pino | Структурированные JSON-логи |
| Auth (deferred) | Auth.js v5 | Появится с 2-м пользователем |

### 2.2 Frontend (отдельное SPA)

| Слой | Технология | Заметки |
|---|---|---|
| Build tool | **Vite** | |
| Framework | React 19+ | |
| Язык | TypeScript | strict mode |
| Styling | **Tailwind CSS v4** | Utility-first. **Изменено 2026-05-28** (ранее — SCSS modules; решение пользователя в пользу Untitled UI). |
| Компонент-кит | **Untitled UI React** (Tailwind + React Aria) | Vendored copy-paste в `src/components/{base,foundations}`. Добавление компонентов — через Untitled UI **MCP** (`untitledui`, `.mcp.json`) или CLI `npx untitledui add`. |
| Routing | React Router v7 | |
| State (server) | TanStack Query | Все данные с API — через RQ |
| State (client UI) | Zustand | Только UI-состояние (модалы, активный шаг, фильтры) |
| Forms | React Hook Form + Zod | |
| DnD | dnd-kit | accessible drag-and-drop |
| HTTP client | fetch (нативный) | при необходимости тонкая обёртка |
| Иконки | `@untitledui/icons` | Передаются как компонент-референсы: `iconLeading={Plus}` |

### 2.3 Worker (Node.js)

| Слой | Технология |
|---|---|
| Runtime | Node.js LTS |
| Scheduler | `node-cron` |
| Прочее | те же библиотеки что и backend (Prisma, caldav, парсинг) |

### 2.4 Общее

| Слой | Технология |
|---|---|
| Unit-тесты | Vitest (backend + frontend) |
| E2E-тесты | Playwright |
| Локаль | RU only |
| Deploy | Self-host VPS + Docker (docker-compose) |
| HTTPS | Caddy / Let's Encrypt |
| Storage файлов | Docker volume |

---

## 3. Высокоуровневая схема

```
┌──────────────────────────────────────────────────────────────────┐
│  ПОЛЬЗОВАТЕЛЬ                                                    │
│                                                                  │
│  ┌─────────┐    ┌──────────┐    ┌──────────────────────┐         │
│  │ Браузер │    │ Telegram │    │  Apple Reminders     │         │
│  │ Web UI  │    │   бот    │    │  (iPhone / Mac)      │         │
│  └────┬────┘    └────┬─────┘    └──────────▲───────────┘         │
└───────┼──────────────┼────────────────────────┼─────────────────┘
        │ REST         │ Bot API               │ CalDAV
        ▼              ▼                       │
┌──────────────────────────────────────────────────────────────────┐
│  VPS (Docker / docker-compose)                                   │
│                                                                  │
│  ┌──────────────┐      ┌──────────────────────────┐              │
│  │  Frontend    │ ───► │     Backend (Next.js)    │              │
│  │  container   │      │                          │              │
│  │  (nginx +    │      │  ┌────────────────────┐  │              │
│  │   Vite SPA)  │      │  │  REST API          │  │              │
│  └──────────────┘      │  │  (Route Handlers)  │  │              │
│                        │  ├────────────────────┤  │              │
│                        │  │  Telegram webhook  │  │              │
│                        │  │  + LLM agent       │  │              │
│                        │  │  (tool-use)        │  │              │
│                        │  └────────────────────┘  │              │
│                        └────────────┬─────────────┘              │
│                                     │                            │
│                                     ▼                            │
│                        ┌────────────────────────┐                │
│                        │      PostgreSQL        │                │
│                        └────────────▲───────────┘                │
│                                     │                            │
│                        ┌────────────┴───────────┐                │
│                        │     Worker container   │                │
│                        │     (node-cron)        │                │
│                        │                        │ ────CalDAV────►│
│                        │  - Парсеры магазинов   │                │
│                        │  - Push Reminders      │                │
│                        │  - Пересчёт остатков   │                │
│                        └────────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / API
                            ▼
                  ┌────────────────────────────┐
                  │  Внешние сервисы           │
                  │  - Anthropic Claude API    │
                  │  - Telegram Bot API        │
                  │  - 5ka.ru, Цех 85, ЛЛ, ВВ  │
                  │  - Apple iCloud (CalDAV)   │
                  └────────────────────────────┘
```

---

## 4. Backend (Next.js)

### 4.1 Структура

```
backend/
├── app/                              # Next.js App Router
│   └── api/                          # REST endpoints (thin wrappers over core services)
│       ├── ingredients/route.ts
│       ├── recipes/                  # Phase 2+
│       ├── plans/                    # Phase 3+
│       ├── ...
│       └── telegram/webhook/route.ts # Phase 6
├── package.json
├── tsconfig.json
├── next.config.ts
└── eslint.config.mjs
```

**Бизнес-логика, Prisma client, парсеры, Zod-схемы — в `core/` workspace** (см. §12), а не в `backend/lib/`. Backend импортирует через `from 'core'`.

### 4.2 Принципы

- **Layered:** Route Handlers тонкие → вызывают service-функции из `core/src/<domain>/service.ts` → те ходят в БД через `core/src/db.ts` (Prisma singleton). В Route Handlers — только парсинг запроса (Zod), вызов сервиса, формирование ответа.
- **Service location:** каждая доменная область — отдельная папка в `core/src/<domain>/` со своими `schemas.ts` (Zod), `service.ts` (бизнес-логика), `*.test.ts` (vitest). Пример: `core/src/ingredients/`.
- **Single source of truth для валидации:** одна Zod-схема используется и в REST endpoint (request body / query), и в Tool Definition для LLM-агента (см. §9.2). Не дублируем.
- **Errors:** структурированные с кодами. Общий error handler для Route Handlers (middleware/wrapper) → 400 для Zod errors с `error.flatten()`, 4xx/5xx остальное.
- **Logging:** структурированный JSON через `pino`.
- **Secrets:** в `.env`, никогда не коммитим.
- **Next.js webpack interop:** `transpilePackages: ['core']` + `resolve.extensionAlias.{'.js': ['.ts', '.tsx', '.js']}` — необходимо для NodeNext ESM imports в core с `.js`-расширениями.

### 4.3 API endpoints (REST)

- `GET /api/<resource>` — list (поддерживает фильтры в query)
- `GET /api/<resource>/:id` — get one
- `POST /api/<resource>` — create
- `PATCH /api/<resource>/:id` — partial update
- `DELETE /api/<resource>/:id` — delete
- `POST /api/<resource>/:id/<action>` — спец. действия (`/approve`, `/recalculate`)

Тело и ответ — JSON. Auth (deferred): Bearer token (Auth.js).

---

## 5. Frontend (Vite + React)

### 5.1 Структура

```
frontend/
├── src/
│   ├── components/                   # VENDORED Untitled UI React (copy-paste kit)
│   │   ├── base/                     #   кнопки, инпуты, селекты, чекбоксы, badges…
│   │   └── foundations/              #   иконки-обёртки, логотипы, featured-icons…
│   ├── utils/                        # VENDORED: cx (tailwind-merge), is-react-component…
│   ├── hooks/                        # VENDORED: use-breakpoint, use-clipboard…
│   ├── providers/                    # VENDORED: theme-provider, router-provider
│   ├── pages/                        # НАШИ route-компоненты (kebab-case)
│   ├── api/                          # НАШ типизированный REST-клиент к backend
│   ├── lib/                          # НАШИ хелперы (useCurrentUser и т.п.)
│   ├── styles/
│   │   ├── globals.css               # @import "tailwindcss" + плагины + @custom-variant
│   │   ├── theme.css                 # дизайн-токены Untitled UI (CSS custom properties)
│   │   └── typography.css
│   ├── App.tsx
│   └── main.tsx
├── public/
├── vite.config.ts                    # @tailwindcss/vite plugin + alias '@' → ./src + /api proxy
├── tsconfig.json
└── package.json
```

`@/*` алиас → `./src/*` (vite resolve.alias + tsconfig paths). Vendored kit (`components/`, `utils/`,
`hooks/`, `providers/`) исключён из eslint — это сторонний код, не наш.

### 5.2 Принципы

- **Untitled UI React** — основной компонент-кит (Tailwind v4 + React Aria). Vendored copy-paste в `src/components/`. Новые компоненты добавляются через Untitled UI **MCP** (tools `search_components` / `get_component`) или CLI `npx untitledui add <name>`, НЕ пишутся вручную с нуля.
- **Tailwind utility-классы** для стилей. **Только семантические цвета** (`text-primary`, `bg-brand-secondary`, `border-tertiary`), не сырые (`text-gray-900`). Типографика — `text-display-sm`, `text-md` и т.п. из темы.
- **Импорты компонентов** через alias: `import { Button } from "@/components/base/buttons/button"`.
- **react-aria-components** импортируй с префиксом `Aria*` (`import { Button as AriaButton } from "react-aria-components"`) — избегаем конфликта имён.
- **Иконки** — компонент-референсами: `iconLeading={Plus}` (из `@untitledui/icons`), не JSX.
- **Имена файлов — kebab-case** (`.tsx`/`.ts`/`.css`), включая наши страницы (`rules-page.tsx`). Это конвенция Untitled UI (переопределяет прежнее PascalCase для frontend, см. §11.1).
- **TanStack Query** для всех данных с API — никогда не используй ручной `useState` для серверных данных.
- **Zustand** только для UI state (модалы, фильтры, активный шаг wizard).
- **Формы** — React Hook Form + Zod (resolver), поверх Untitled UI инпутов.

### 5.3 Стратегия разработки UI: backend-first

Внутри каждой Phase сначала закрываем backend-слой целиком (миграции → service → API endpoints → тесты), потом одной итерацией рисуем нужные web-страницы Phase'ы.

**Почему так:**
- Phase 1 уже доказала, что без UI можно дойти до full-stack acceptance (curl + smoke). Это валидирует API раньше, чем оно увидит браузер.
- UI зависит от ясного API-контракта. Если рисовать UI параллельно с API — меняется и то, и то, лишняя боль.
- В конце Phase у нас целиком новый API, и страницы можно делать пачкой с одним стилевым прохождением.

**Антипаттерн:** «начать UI и потом доделать сервис» — приводит к моку API на фронте, который дрейфует.

**Telegram-агент vs web UI:** некоторые `scr-edit-*` фичи (Phase 2/5) — это CRUD-формы; они доступны и через web UI, и через агента (Phase 6) одной service-функцией.

---

## 6. Worker (cron + долгие задачи)

Отдельный контейнер. Запускает:

| Задача | Расписание | Описание |
|---|---|---|
| Парсинг 5К | Сб 03:00 | `scr-parse-5ka` обновляет ingredients из Пятёрочки |
| Парсинг Цех | Сб 03:15 | `scr-parse-tseh` |
| Парсинг ЛЛ | Сб 03:30 | `scr-parse-ll` |
| Парсинг ВВ | Сб 03:45 | `scr-parse-vv` |
| Push Reminders | Ежедневно 04:00 | `scr-notifications` → создаёт задачи в Apple Reminders на день |
| Пересчёт остатков | После события | `scr-calc-stock` (trigger от backend по очереди) |

Worker и backend используют **одну БД** (Postgres) и общую кодовую базу через workspace `core/` (см. §12). Парсер, Prisma client, бизнес-логика — там. backend и worker импортируют через `from 'core'`.

**Runtime:** worker НЕ компилируется в `dist/` через tsc — вместо этого CMD контейнера `npx tsx worker/src/index.ts`. Причина: `core` экспортирует TS-исходники (`main: ./src/index.ts`), Node не запустит `.ts` напрямую, а bundling-шаг (esbuild/tsup) — overkill на текущем масштабе. tsx добавляет ~5MB в runtime образ — приемлемо. Если в будущем нужен будет cold-start < 1s, перейдём на bundling.

---

## 7. База данных

### 7.1 Принципы

- **3NF нормализация** где практично
- **FK `user_id`** на каждой пользовательской таблице (multi-tenant-ready)
- **Soft delete:** не используем (hard delete)
- **Audit log:** не используем
- **Timestamps:** `created_at`, `updated_at` на каждой таблице
- **Миграции:** Prisma Migrate (`prisma migrate dev`/`deploy`)
- **Seeding:** clean slate. Парсеры наполняют каталог при первом запуске

### 7.2 Tag-based архитектура правил (центральный концепт Phase 2)

Все правила питания пользователя выражаются через **теги на ингредиентах** + **теги на рецептах** + **записи в `tag_rules`**. Валидатор — это **SQL-запросы**, а не интерпретатор правил.

**Слои:**

1. **`tag_dictionary`** — справочник допустимых тегов с категорией (`NUTRIENT | ALLERGEN | CATEGORY | BEHAVIOR | MEAL_TAG | OTHER`). Loose coupling: `ingredients.tags` и `recipe_tags` — это `text[]` / `text`, не FK. UI берёт отсюда автокомплит, Zod валидирует имена.

2. **`ingredients.tags text[]`** — массив тегов на ингредиенте. Постгрес `GIN`-индекс. Примеры: `['protein', 'lactose', 'dairy']` для молока; `['protein', 'iron', 'liver']` для печени; `['caffeine']` для кофе.

3. **`recipe_tags`** — junction (recipe_id, tag_name) для meal-уровневых тегов: `iron_meal`, `sweet_breakfast`, `training_meal`, `c1_exclusion`.

4. **`tag_rules`** — все правила пользователя: `rule_kind` ∈ `{BAN_TAG, BAN_TAG_IN_MEAL, REQUIRE_TAG_IN_MEAL, MIN_PER_WEEK, MAX_PER_WEEK}` + `tag_name` + опц. `meal_tag`, `quantity`, `exception_tag`.

**Все пользовательские правила превращаются в строки `tag_rules`:**

| Правило (бизнес) | rule_kind | tag_name | meal_tag | quantity | exception_tag |
|---|---|---|---|---|---|
| Запрет чеснока (§13a) | BAN_TAG | garlic | — | — | — |
| Запрет whey | BAN_TAG | whey | — | — | — |
| Алкоголь ≤ 1×/нед | MAX_PER_WEEK | alcohol | — | 1 | — |
| Курица ≥ 4×/нед | MIN_PER_WEEK | chicken | — | 4 | — |
| Печень 1×/нед | MIN_PER_WEEK | liver | — | 1 | — |
| ЛЛ-десерты ≤ 3×/нед | MAX_PER_WEEK | ll_dessert | — | 3 | — |
| Iron meal — без молочки | BAN_TAG_IN_MEAL | lactose | iron_meal | — | — |
| Iron meal — без кофеина | BAN_TAG_IN_MEAL | caffeine | iron_meal | — | — |
| C1 (без сладкого хвоста) | BAN_TAG_IN_MEAL | dessert | sweet_tail | — | c1_exclusion |

**Расширяемость без миграций:**
- Новый тип ограничения через комбинацию tag + meal_tag (без миграций).
- Новый `RuleKind` — это enum в schema → миграция (но добавляется редко).

**Где код валидатора:** `core/src/validation/` (появится в scr-validate-recipes).

### 7.3 Валидатор правил (rule engine)

**Контракт:** `validateRecipe(recipeId): Promise<{ isApproved: boolean; rejectionReasons: string[] }>`.

**Реализация:** для каждого активного `TagRule` пользователя — одна SQL-выборка. Никаких if/else-деревьев по `rule_kind`. Примеры запросов:

```sql
-- BAN_TAG: "есть ли в рецепте ингредиент с этим тегом?"
SELECT name FROM ingredients i
  JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
  WHERE ri.recipe_id = $1 AND $2 = ANY(i.tags)
LIMIT 1;

-- REQUIRE_TAG_IN_MEAL: "есть ли хоть один ингредиент с этим тегом, если рецепт помечен meal_tag?"
SELECT EXISTS(
  SELECT 1 FROM ingredients i
  JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
  JOIN recipe_tags rt ON rt.recipe_id = ri.recipe_id
  WHERE ri.recipe_id = $1 AND rt.tag_name = $2 AND $3 = ANY(i.tags)
);
```

**Ограничения уровня:**
- `BAN_TAG` / `BAN_TAG_IN_MEAL` / `REQUIRE_TAG_IN_MEAL` — проверяются **на уровне рецепта** (validator decides).
- `MIN_PER_WEEK` / `MAX_PER_WEEK` — **не имеют смысла на уровне одного рецепта**, проверяются только в `scr-calc-week-plan` (Phase 3) на готовом плане недели. Validator возвращает их как «pending» (не учитываются в is_approved).

**Exception_tag:** если рецепт имеет тег из `exception_tag` правила — правило пропускается. Пример: рецепт с `c1_exclusion` тегом игнорирует правило «без сладкого хвоста».

### 7.4 Сущности (см. `ROADMAP.json` для полного списка)

**Системные:** `users`, `profiles`, `telegram_accounts`

**Здоровье:** `health_records`

**Источники данных:** `source_5ka`, `source_tseh`, `source_ll`, `source_vv`

**Каталог:** `ingredients`, `recipes` (с флагами `is_relevant` / `is_normalized` / `is_approved`)

**Планирование:** `nutrition_rules`, `stock`, `carts`, `week_plans` → `days` → `meals` → `meal_items`, `order_history`

**Учёт:** `food_diary`

**Уведомления:** `notification_schedules`

**Агент:** `agent_conversations`

Полная схема — в `backend/prisma/schema.prisma` после первой миграции.

---

## 8. Внешние интеграции

### 8.1 Anthropic Claude API

- Используется в: LLM-агент (Telegram), поиск рецептов, расчёт плана недели
- SDK: `@anthropic-ai/sdk`
- Env: `ANTHROPIC_API_KEY`
- Подход к стоимости: кэшировать промпты где можно (Anthropic prompt caching)

### 8.2 Telegram Bot API

- Библиотека: grammY
- Транспорт: webhook (`/api/telegram/webhook`)
- Linking user ↔ telegram_chat_id: одноразовый токен через `/start <token>`
- Env: `TELEGRAM_BOT_TOKEN`

### 8.3 Apple Reminders (CalDAV)

- Подход: App-Specific Password (см. `arc.md` секция A в ветке main)
- Библиотека: `caldav` (npm)
- Конфиг: `APPLE_ID`, `APPLE_APP_PASSWORD` в env
- Целевой список: `Daily` (имя конфигурируемо)
- Дедупликация задач — по UID

### 8.4 Парсеры магазинов: stub-first стратегия

Метод (API / scraping / iframe / OCR) — **TBD per parser**: реальные endpoints магазинов закрыты anti-bot, требуют reverse-engineered cookies/headers из браузерной сессии пользователя.

**Стратегия двух фаз для каждого парсера:**

1. **Stub (default, реализован):** `core/src/parsers/<name>/stub-parser.ts` читает фикстуру (`__fixtures__/sample.json`). Полный pipeline (parse → map → UPSERT в `ingredients` + INSERT в `source_*`) работает на mock-данных. Используется в dev/тестах + наполняет dev-БД для UI-разработки. Управление: env `<NAME>_PARSER_MODE=stub` (default).

2. **API (в backlog):** `core/src/parsers/<name>/api-parser.ts` — skeleton с JSDoc-инструкцией: пользователь предоставляет endpoints через DevTools (Network → Copy as fetch), коды/cookies/User-Agent через env. Включается через `<NAME>_PARSER_MODE=api`.

**Идемпотентность гарантирована на уровне БД:** unique key `(name, source, pack_size)` в `ingredients`. Повторный запуск парсера — обновляет цены/КБЖУ через UPSERT, не дублирует строки. `source_*` таблицы — append-only снимки (история парсов).

**Решение о реальном API** — фиксируется в `HISTORY.md` при первой реализации каждого реального парсера.

---

## 9. LLM-агент в Telegram

### 9.1 Архитектура

```
Telegram update ─► /api/telegram/webhook
                       │
                       ▼
                ┌────────────────────────────┐
                │ Identify user              │
                │ by telegram_chat_id        │
                │ (FK telegram_accounts)     │
                └────────────┬───────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │ Load context: last N msgs  │
                │ from agent_conversations   │
                └────────────┬───────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │ Claude API call            │
                │ with:                      │
                │  - system prompt           │
                │  - history                 │
                │  - tool definitions        │
                │    (all CRUD scripts)      │
                └────────────┬───────────────┘
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
            ┌─────────┐           ┌─────────────┐
            │ Text    │           │ Tool call   │
            │ reply   │           │             │
            └────┬────┘           └──────┬──────┘
                 │                       │
                 │                       ▼
                 │              Execute corresponding
                 │              `lib/` function
                 │                       │
                 │                       ▼
                 │              Format result, loop
                 │              back to Claude
                 │
                 ▼
        ┌────────────────┐
        │ Send reply to  │
        │ Telegram +     │
        │ save to        │
        │ agent_conver-  │
        │ sations        │
        └────────────────┘
```

### 9.2 Tool-use

Каждый бизнес-скрипт (`scr-*` из ROADMAP) экспонируется агенту как **tool**:

- Имя tool = `id` из ROADMAP (например, `scr-correct-plan`)
- Описание = `description` из ROADMAP
- Input schema = Zod-схема (та же, что и в REST endpoint)

Агент сам выбирает tool по сообщению пользователя. Результат tool возвращается обратно в Claude для формулировки человекочитаемого ответа.

### 9.3 Безопасность

- Авторизация: входящее сообщение → `telegram_chat_id` → `telegram_accounts.user_id` → действия только в scope этого юзера
- Никаких прямых SQL-команд от агента — только через tool definitions

### 9.4 Где живёт LLM-логика

Сам код Claude API + промптов + retry — **в отдельном микросервисе `llm-service`** (см. §10), не в backend. Backend и worker ходят к нему через HTTP. Telegram-агент тоже — webhook в backend перенаправляет запросы в llm-service через очередь.

---

## 10. LLM-сервис (отдельный микросервис)

### 10.1 Обоснование

LLM-вызовы (search-recipes, calc-week-plan, telegram-agent) — общая инфраструктура: промпты, retry, cost-tracking, prompt caching, выбор провайдера. Выносим в отдельный workspace + Docker container `llm-service` с момента старта (см. HISTORY 2026-05-25):

- **Единый источник промптов** и cost-logging для всех 3 потребителей.
- **Adapter pattern** позволяет менять LLM провайдера (Claude → OpenAI → Gemini) без правок в backend/worker — только смена `LLM_PROVIDER` env.
- **Изоляция API-key**: только llm-service знает ключи.
- **Готовность к Python**: если позже понадобятся embeddings / локальные ML — переписываем llm-service, контракт HTTP не меняется.
- **Очередь** обеспечивает persistence (job выживает рестарт), retry, decoupling.

### 10.2 Стек llm-service

| Слой | Технология | Заметки |
|---|---|---|
| Runtime | Node.js LTS 22 | tsx в runtime (см. §6, тот же подход что и worker) |
| HTTP framework | **Hono** | Modern, type-safe, fast, multi-runtime |
| Queue | **pg-boss** | Postgres-native, без Redis. Достаточно для текущего масштаба |
| Adapters | TypeScript classes | `AnthropicAdapter`, `OpenAIAdapter`, … |
| LLM SDK | `@anthropic-ai/sdk` (first) | + `openai` SDK когда понадобится |
| Validation | Zod | Promot input + response schemas |
| Logging | pino | + cost-tracking в `llm_jobs` |

### 10.3 Структура

```
llm-service/
├── src/
│   ├── index.ts                # Hono app + pg-boss subscriber
│   ├── server.ts               # HTTP routes
│   ├── adapters/
│   │   ├── adapter.ts          # interface LLMAdapter
│   │   ├── anthropic.ts        # AnthropicAdapter (first)
│   │   ├── stub.ts             # StubAdapter (для тестов и dev без API key)
│   │   └── cli.ts              # ClaudeCliAdapter (опц.: spawns `claude` CLI)
│   ├── jobs/
│   │   ├── queue.ts            # pg-boss setup
│   │   ├── search-recipes.ts   # job handler
│   │   ├── calc-plan.ts        # (Phase 3)
│   │   └── agent-reply.ts      # (Phase 6, Telegram)
│   ├── prompts/
│   │   ├── search-recipes.ts   # PROMPT_TEMPLATE + buildPrompt()
│   │   ├── calc-plan.ts
│   │   └── agent-system.ts
│   └── schemas/
│       ├── search-recipes.ts   # Zod schema ожидаемого ответа Claude
│       └── ...
├── package.json
├── tsconfig.json
└── Dockerfile
```

### 10.4 HTTP-контракт

Async job pattern. Backend/worker дёргают endpoint, получают job_id, либо ждут синхронно (long-polling до 60 сек), либо опрашивают.

| Endpoint | Использование |
|---|---|
| `POST /jobs` body `{kind: 'search-recipes'\|'calc-plan'\|'agent-reply', input: {...}}` | Enqueue job, response `{job_id}` |
| `GET /jobs/:id` | `{status: 'pending'\|'running'\|'completed'\|'failed', result?, error?, cost?}` |
| `POST /jobs/:id/wait?timeout=60` | Long-poll: ждёт до timeout сек или завершения |
| `GET /healthz` | Liveness |

### 10.5 Job lifecycle

```
backend ──POST /jobs──► llm-service (Hono)
                            │
                            └── enqueue в pg-boss (Postgres `pgboss.job` table)
                            │
                            └── return job_id

pg-boss subscriber (тот же container llm-service) подхватывает:
  job → adapter.generate(prompt, schema) → Zod validate → store result
                                             │
                                             └── update `llm_jobs` table (наша)
backend ──POST /jobs/:id/wait──► long-poll до status=completed/failed
                                             │
                                             └── вернуть result
```

### 10.6 Adapter contract

```ts
interface LLMAdapter {
  generateStructured<T>(args: {
    systemPrompt: string;        // что заведомо не меняется (правила, профиль) — кэшируется
    userPrompt: string;
    responseSchema: ZodSchema<T>;
    maxRetries?: number;
    enablePromptCache?: boolean; // Anthropic-specific, OpenAI ignores
  }): Promise<{
    result: T;
    cost: { inputTokens, outputTokens, cacheRead, cacheWrite, usd };
    durationMs: number;
  }>;
}
```

Один интерфейс, несколько имплементаций. `AnthropicAdapter` использует `cache_control: { type: 'ephemeral' }` (см. ниже). `OpenAIAdapter` игнорирует флаг, OpenAI caching работает иначе.

### 10.7 Dev режимы

`LLM_MODE` env:

| Mode | Что делает | Когда использовать |
|---|---|---|
| `stub` | Возвращает фикстуры из `llm-service/src/fixtures/<kind>.json` | Юнит-тесты, dev без API key, smoke runs |
| `cli` | Spawns `claude` CLI в shell, парсит stdout, валидирует Zod | Локальный dev с авторизованным CLI пользователя |
| `api` | Реальный Anthropic SDK вызов | Production, integration tests |

`LLM_PROVIDER` env: `anthropic` (default) / `openai` / `gemini` (когда добавимся).

### 10.8 Промпты

Каждый промпт = отдельный TS-файл в `llm-service/src/prompts/<name>.ts`. Экспорт:

```ts
export const SYSTEM_PROMPT = `Ты диетолог. Профиль: ...`;  // кэшируется
export function buildUserPrompt(args: {...}): string { ... }
export const RESPONSE_SCHEMA = z.object({...});  // импортируется handlers
```

Версионируется через git.

### 10.9 Prompt caching

Для Anthropic-провайдера: системный промпт (профиль пользователя + правила + список одобренных рецептов) маркируется `cache_control: { type: 'ephemeral' }`. Кэш живёт 5 мин. Экономия токенов когда в одной сессии: generate plan → validate → fix → retry; или последовательные `agent-reply` вызовы в Telegram.

### 10.10 Schema validation ответа

Каждый ответ LLM **обязательно валидируется Zod**:

- Успех → result сохраняется.
- Невалидно → retry с `system` correction prompt (`"твой ответ не прошёл schema X — поправь поле Y"`). Max 2 retry.
- 3 невалидных подряд → job failed, ошибка во `llm_jobs.error`.

### 10.11 Error handling и retry

| Ошибка | Стратегия |
|---|---|
| `429 Rate limit` | Exponential backoff (1s, 2s, 4s), max 3 попытки |
| `500/503` | 1 retry через 2s, потом fail |
| `400 Invalid request` | Не retry — log + fail (баг промпта) |
| `Timeout` (60s default) | 1 retry, потом fail |
| Zod validation fail | См. §10.10 — max 2 schema-correction retries |

Retry-логика на уровне adapter'а (provider-specific) + общая retry pg-boss (3 попытки для job-level failures).

### 10.12 Cost tracking

Каждый завершённый job → запись в `llm_jobs` (новая Prisma модель):

```
llm_jobs
- id, job_kind, user_id?, provider, model
- status enum [pending, running, completed, failed]
- input_tokens, output_tokens, cache_read_tokens, cache_write_tokens
- cost_usd Decimal
- duration_ms int
- created_at, completed_at, error?
```

Используется для:
- Месячного отчёта по стоимости
- Алертинга при превышении лимита
- Debugging (полный input/output можно хранить в jsonb)

### 10.13 Безопасность

- **Изоляция API key**: только llm-service видит `ANTHROPIC_API_KEY` (и др. провайдеры). Backend знает только URL llm-service.
- Передавать в LLM только нужный контекст (имя, КБЖУ, правила, рецепты). Никаких паролей, токенов, личных данных вне scope диетологии.
- Системные действия (auth, payments) — никогда через LLM (таких в проекте нет, но фиксируем принцип).

---

## 11. Деплой

### 11.1 Docker Compose (фактическая конфигурация)

Полный файл в корне репозитория. **5 сервисов:** postgres, backend, worker, frontend, **llm-service** (добавлен 2026-05-25, см. §10).

Ключевые моменты:

- **Build context = корень монорепо** (`.`), `dockerfile: ./<workspace>/Dockerfile`. Нужно для npm workspaces (Dockerfile copies `package.json`, `core/`, `<workspace>/`, выполняет `npm ci --workspaces`).
- **Postgres healthcheck** через `pg_isready`, `depends_on: { postgres: { condition: service_healthy } }` для backend/worker/llm-service.
- **pg-boss queue tables** в Postgres `pgboss` schema — создаются автоматически при первом старте llm-service (`pgboss.start()`).
- **Prisma migrate** в build-time через `core/prisma`: `WORKDIR /repo/core && npx prisma generate`.
- **Volume:** `postgres_data`.
- **Сетка:** дефолтная bridge.
- **Порты:** postgres 5432, backend 3000, frontend (nginx) 80→8080, llm-service 3001 (internal-only, не публикуется наружу).

Применение миграций при первом запуске:
```bash
docker compose up -d postgres                            # дожидаемся healthy
npm run prisma:migrate:deploy --workspace core           # с хоста: миграции схемы
docker compose up -d backend worker llm-service frontend # остальные сервисы (llm-service сам создаст pgboss tables)
```

В production миграции применяются через **отдельный one-shot контейнер** (deploy-time, до старта backend), не на каждом старте backend. Конкретный механизм (helm job / docker compose run --rm migrator) — выбирается при деплое.

### 10.2 Окружение

- Linux VPS (Ubuntu LTS) + Docker + docker-compose
- HTTPS через Caddy (reverse proxy перед frontend container) или встроенный в nginx
- Бэкапы Postgres: cron в worker → дамп → внешнее хранилище (S3 / rsync, TBD)
- Логи: stdout всех контейнеров → `journalctl` / Loki (TBD)

---

## 11. Конвенции

### 11.1 Код

- TypeScript strict mode (`"strict": true`)
- ESLint + Prettier (общий конфиг для backend и frontend)
- Naming: `camelCase` (variables/functions), `PascalCase` (types/components/classes), `kebab-case` (filenames кроме компонентов)

### 11.2 Git

- Активная ветка: `rework/nextjs-postgres` (feature-branches от неё, мерж в неё)
- `main` НЕ трогать — там старое Python-приложение в проде
- Коммиты: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)

### 11.3 Документация

Источник правды в 4 файлах:
- `docs/ROADMAP.json` — что нужно делать (фичи + статусы)
- `docs/PLAN.md` — когда и в каком порядке (фазы)
- `docs/HISTORY.md` — что уже было (append-only лог)
- `docs/ARCHITECTURE.md` — как устроено (этот файл)

Любая значимая итерация → запись в `HISTORY.md` + обновление статуса в `ROADMAP.json` + отметка в `PLAN.md`.

---

## 12. Структура репозитория

```
App/                          # репозиторий на ветке rework/nextjs-postgres
├── docs/
│   ├── ROADMAP.json
│   ├── PLAN.md
│   ├── HISTORY.md
│   └── ARCHITECTURE.md       # этот файл
│
├── core/                     # Общая библиотека (npm workspace)
│   ├── prisma/               # Prisma schema + миграции
│   └── src/
│       ├── db.ts             # PrismaClient singleton
│       ├── parsers/          # Парсеры магазинов
│       ├── ingredients/      # Service layer
│       ├── validation/       # Tag-based rule engine
│       └── normalization/    # Fuzzy match + unit conversion
│
├── llm-service/              # LLM микросервис (Hono + pg-boss)
│   └── src/{adapters,jobs,prompts,schemas}/
│
├── backend/                  # Next.js REST API (импортирует из 'core', дёргает llm-service)
│
├── frontend/                 # Vite + React SPA
│
├── worker/                   # node-cron-задачи (импортирует из 'core', дёргает llm-service)
│
├── docker-compose.yml
├── CLAUDE.md                 # правила для AI-агента
└── README.md                 # описание для людей
```

В `main` сейчас лежит Python-версия (`meal_planner/`, `data/`, `plans/`, `tests/`). После merge rework'a в main она будет заменена на новую структуру.

---

## 13. История изменений архитектуры

(Append-only, кратко. Большие изменения дублируем в `HISTORY.md` с обоснованием.)

### 2026-05-28 — Frontend: SCSS modules → Tailwind v4 + Untitled UI React

**Обоснование:** явное решение пользователя — использовать Untitled UI React (Tailwind CSS v4 + React Aria) как компонент-кит для всего приложения + их MCP-сервер, полностью компонентный подход.

**Что меняется (§2.2, §5):**
- Styling: SCSS modules → **Tailwind CSS v4** (`@tailwindcss/vite`). Удалены `*.scss` (variables/reset/global/App.module).
- Добавлен компонент-кит **Untitled UI React** — vendored copy-paste в `src/components/{base,foundations}` (+ `utils/`, `hooks/`, `providers/`). Это сторонний код → исключён из eslint.
- **MCP-сервер `untitledui`** (`.mcp.json`, project scope, `https://www.untitledui.com/react/api/mcp`) — tools для поиска/добавления компонентов. Доступен со следующей сессии.
- Иконки: `@untitledui/icons` (раньше TBD lucide).
- Конвенция имён файлов frontend: **kebab-case** (переопределяет PascalCase из §11.1 для frontend) — требование Untitled UI.
- `@/*` alias → `./src/*` (vite + tsconfig). frontend tsconfig.app.json выровнен под кит: `jsx: preserve`, `lib: ESNext`, убраны `noUncheckedIndexedAccess` + `noImplicitOverride` (vendored код их не проходит). `strict` сохранён.
- Деплой §11: frontend Docker по-прежнему nginx + статика Vite — без изменений (Tailwind компилируется в build-time).

**Что НЕ меняется:** backend/core/worker/llm-service стек и их strict-tsconfig; разделение frontend/backend; SPA + REST контракт.

### 2026-05-25 — LLM выделен в отдельный микросервис + очередь pg-boss

Существенная перестройка слоя LLM до начала scr-search-recipes.

**Что меняется:**
- §9.4 (раньше всё LLM-policy здесь) → перенесено в новую **§10 LLM-сервис**. §9 теперь только про Telegram-агента + интеграцию через очередь.
- **Новая §10:** llm-service как отдельный workspace + Docker container. Внутри: Hono HTTP server, pg-boss queue (Postgres-native, без Redis), adapter pattern (`AnthropicAdapter` first, OpenAI/Gemini ready to plug). Async job lifecycle с long-polling endpoint. Cost tracking в новой таблице `llm_jobs`.
- **Стек llm-service:** Node 22 + tsx runtime + Hono + pg-boss + Zod + pino.
- **Dev режимы:** `LLM_MODE=stub|cli|api` — stub для тестов, cli для local dev с авторизованным `claude`, api для прода.
- **Провайдеры через env:** `LLM_PROVIDER=anthropic|openai|gemini` — adapter pattern изолирует API-разницу.
- §11 (бывшая §10) — обновлена для 5 контейнеров (+llm-service).
- §12 — структура `App/` обновлена: +`llm-service/`.

**Почему сейчас:**
- Решение пользователя: 2+ пользователей в перспективе, нет SLA гарантий от Anthropic — нужна персистентная очередь.
- 3 будущих потребителя LLM (search-recipes/calc-plan/telegram-agent) — общая инфраструктура промптов и cost-tracking.
- Готовность к смене провайдера (Claude → OpenAI / Gemini) одной env-переменной.
- Готовность к Python-микросервису, если потребуются embeddings / локальные ML.

**Что НЕ меняется в этой итерации:** код. Документ-первый подход. Skeleton llm-service + scr-search-recipes — отдельные итерации.

### 2026-05-25 — Большой апдейт после Phase 1 + старт Phase 2 (10 правок)

Контракт приведён в соответствие с кодом + зафиксированы 4 новые концепции.

**Drift fixes (приведение к коду):**
- §4.1: структура backend теперь содержит только `app/api/`. Бизнес-логика в `core/` (из refactor caa6c95).
- §4.2: добавлено про service-функции в `core/src/<domain>/`, единая Zod-схема для REST + LLM-агент tool definitions, Next.js webpack interop (`transpilePackages` + `extensionAlias`).
- §6: явно зафиксирован `tsx` в runtime для worker (без bundling), решение из commit 7f7a204.
- §8.4: stub-first / API-second стратегия парсеров. Идемпотентность через DB unique key.
- §10.1: обновлена docker compose секция под фактическую конфигурацию (root build context, core/prisma путь, application миграций).

**Новые концепции:**
- **§5.3 Стратегия разработки UI** — backend-first, UI в конце каждой Phase. Аргументация + антипаттерн.
- **§7.2 Tag-based архитектура правил** — центральный концепт Phase 2. tag_dictionary, ingredients.tags, recipe_tags, tag_rules. Все правила пользователя → строки tag_rules. Расширяемость без миграций для большинства новых правил.
- **§7.3 Валидатор правил (rule engine)** — контракт `validateRecipe()`, SQL-выборки на каждый TagRule, разделение «recipe-level» vs «week-level» правил (MIN/MAX_PER_WEEK).
- **§9.4 LLM-вызовы вне агента** — где код (`core/src/llm/`), где промпты (отдельные файлы), prompt caching через ephemeral, обязательная Zod-валидация ответа Claude перед БД, retry policy, cost logging через pino.

### 2026-05-24 — Добавлен shared workspace `core/`

Снят TBD из §6 о shared lib. Создан 4-й npm workspace `core/`. Туда переехали: `prisma/` (schema + миграции + client singleton), `parsers/`, `ingredients/` (Zod-схемы + service). Backend и worker импортируют через `from 'core'`. Backend настроен с `transpilePackages: ['core']` + webpack `extensionAlias` для NodeNext-ESM-импортов с `.js`-расширениями.

### 2026-05-24 — Документ создан
- Зафиксированы все стек-решения после обсуждения с пользователем
- Frontend и backend **разделены**: Next.js = только API + worker, отдельное Vite/React SPA для UI
- ORM: **Prisma** (выбор между Prisma и Drizzle — Prisma победила по зрелости миграций и Prisma Studio)
- Styling: **SCSS modules** вместо Tailwind/shadcn (явное решение пользователя на простой стек)
- Нотификации: **Apple Reminders через CalDAV** (см. `arc.md` секция A)
- Telegram: LLM-агент с полным tool-use доступом ко всем CRUD-скриптам
- Деплой: Self-host VPS + Docker compose (4 контейнера: backend, frontend, worker, postgres)
