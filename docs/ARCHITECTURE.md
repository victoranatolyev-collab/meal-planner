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
| Styling | **SCSS modules** | BEM-like классы. **Без Tailwind/shadcn.** |
| Routing | React Router v7 | |
| State (server) | TanStack Query | Все данные с API — через RQ |
| State (client UI) | Zustand | Только UI-состояние (модалы, активный шаг, фильтры) |
| Forms | React Hook Form + Zod | |
| DnD | dnd-kit | accessible drag-and-drop |
| HTTP client | fetch (нативный) | при необходимости тонкая обёртка |
| Иконки | TBD (`lucide-react`?) | |

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
│   └── api/                          # REST endpoints
│       ├── users/
│       ├── profile/
│       ├── recipes/
│       ├── plans/
│       ├── ingredients/
│       ├── ...
│       └── telegram/
│           └── webhook/route.ts      # Telegram webhook
├── lib/                              # Бизнес-логика, не зависит от Next.js
│   ├── agent/                        # LLM-агент: tool definitions + orchestration
│   ├── parsers/                      # 5К, Цех, ЛЛ, ВВ
│   ├── reminders/                    # CalDAV helpers
│   ├── plan/                         # Расчёт плана недели (LLM + greedy fallback)
│   ├── validation/                   # Правила питания (валидатор рецептов)
│   └── db.ts                         # Prisma client singleton
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── package.json
├── tsconfig.json
└── next.config.ts
```

### 4.2 Принципы

- **Layered:** Route Handlers тонкие → вызывают функции из `lib/` → те ходят в БД через Prisma. В Route Handlers — только парсинг запроса (Zod), вызов сервиса, формирование ответа.
- **Zod everywhere:** все request bodies валидируются Zod. Tool definitions для агента — генерируются из тех же Zod-схем.
- **Errors:** структурированные с кодами. Общий error handler для Route Handlers (middleware/wrapper).
- **Logging:** структурированный JSON через `pino`.
- **Secrets:** в `.env`, никогда не коммитим.

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
│   ├── components/                   # Переиспользуемые компоненты
│   │   └── DayCard/
│   │       ├── DayCard.tsx
│   │       ├── DayCard.module.scss
│   │       └── index.ts
│   ├── pages/                        # Route components
│   ├── api/                          # Типизированный REST-клиент
│   ├── hooks/                        # React hooks
│   ├── store/                        # Zustand stores
│   ├── styles/                       # Глобальный SCSS: variables, mixins, reset
│   ├── App.tsx
│   └── main.tsx
├── public/
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 5.2 Принципы

- **Один компонент = одна папка** (`Component/Component.tsx` + `Component.module.scss` + `index.ts`)
- **SCSS modules** для component-level стилей (`*.module.scss`)
- **Глобальный SCSS** только для design tokens (переменные цветов, отступов, типографики), миксинов, reset
- **BEM-like** именование классов внутри модулей
- **TanStack Query** для всех данных с API — никогда не используй ручной `useState` для серверных данных
- **Zustand** только для UI state (модалы, фильтры, активный шаг wizard)

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

Worker и backend используют **одну БД** (Postgres) и общую `lib/` через monorepo-структуру или git submodule (TBD).

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

### 7.2 Сущности (см. `ROADMAP.json` для полного списка)

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

### 8.4 Парсеры магазинов

Метод (API / scraping / iframe / OCR) — **TBD per parser** при реализации. Решение фиксируется в `HISTORY.md` при первой реализации каждого.

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

---

## 10. Деплой

### 10.1 Docker Compose (целевая конфигурация)

```yaml
services:
  postgres:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    env_file: .env

  backend:
    build: ./backend
    depends_on: [postgres]
    env_file: .env
    expose: ["3000"]

  worker:
    build: ./worker
    depends_on: [postgres]
    env_file: .env

  frontend:
    build: ./frontend       # builds Vite, ставит nginx как сервер
    ports: ["80:80", "443:443"]
    depends_on: [backend]

volumes:
  postgres_data:
```

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
├── backend/                  # Next.js (REST API + worker entry, App Router)
│   └── (создаётся в Phase 1)
│
├── frontend/                 # Vite + React SPA
│   └── (создаётся в Phase 1+)
│
├── worker/                   # node-cron-задачи
│   └── (создаётся в Phase 2+)
│
├── docker-compose.yml        # (создаётся в Phase 1)
├── CLAUDE.md                 # правила для AI-агента
└── README.md                 # (обновится позже, описание для людей)
```

В `main` сейчас лежит Python-версия (`meal_planner/`, `data/`, `plans/`, `tests/`). После merge rework'a в main она будет заменена на новую структуру.

---

## 13. История изменений архитектуры

(Append-only, кратко. Большие изменения дублируем в `HISTORY.md` с обоснованием.)

### 2026-05-24 — Документ создан
- Зафиксированы все стек-решения после обсуждения с пользователем
- Frontend и backend **разделены**: Next.js = только API + worker, отдельное Vite/React SPA для UI
- ORM: **Prisma** (выбор между Prisma и Drizzle — Prisma победила по зрелости миграций и Prisma Studio)
- Styling: **SCSS modules** вместо Tailwind/shadcn (явное решение пользователя на простой стек)
- Нотификации: **Apple Reminders через CalDAV** (см. `arc.md` секция A)
- Telegram: LLM-агент с полным tool-use доступом ко всем CRUD-скриптам
- Деплой: Self-host VPS + Docker compose (4 контейнера: backend, frontend, worker, postgres)
