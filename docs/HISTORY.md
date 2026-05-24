# История разработки

> **Хронологический лог итераций.**
> Что сделано, с чем столкнулся, какие решения принял. Кратко — 2-5 строк на запись.
>
> **Заполнять при КАЖДОЙ значимой итерации.** Правило прописано в `CLAUDE.md`.

---

## Формат записи

```markdown
## YYYY-MM-DD — <Краткий заголовок>
- **Сделано:** ...
- **Столкнулся:** ... *(опционально, если было)*
- **Решение:** ... *(опционально, если принимал)*
- **Файлы:** path/to/file.ts, path/to/other.ts *(опционально)*
- **Коммит:** <hash> *(после коммита)*
```

Записи в **обратном хронологическом порядке** (новые сверху).

---

## 2026-05-24 — Phase 0 / шаг 4: Prisma + первая миграция (ent-users + ent-profile)

- **Сделано:** подключил Prisma 6 в backend (`prisma` dev + `@prisma/client` dep + 4 npm-скрипта prisma:*). Создал `backend/prisma/schema.prisma` с моделями `User` (id uuid, email unique, timestamps) и `Profile` (1:1 с User через `user_id` unique FK + onDelete: Cascade; поля: firstName, lastName, locale='ru', timestamps). Snake_case колонки через `@map`, snake_case таблицы через `@@map("users"/"profiles")`. Сгенерировал миграцию `20260524192718_init/migration.sql` через `prisma migrate diff --from-empty` — не требует живого Postgres. `backend/lib/db.ts` — singleton PrismaClient (защита от множественных коннектов в dev hot-reload).
- **Решение:** UUID v4 как PK (Prisma default uuid). Антропометрия (рост/вес/возраст) НЕ в Profile — пойдёт в `health_records` (Phase 3). Auth-поля (password/sessions) тоже не сейчас — добавим с Auth.js. Prisma живёт в backend; worker подключится к этому же schema позже (Phase 1+) — точная схема импорта решится при первом cron-парсере.
- **Столкнулся:** `prisma validate` ругался на отсутствие `DATABASE_URL` env. Workaround: inline-передал env var для validate. Для format/generate переменная не нужна.
- **Проверки:** `prisma format`, `prisma validate` (с env), `prisma generate` → client в `node_modules/@prisma/client` (v6.19.3), `tsc --noEmit`, `next build`, `eslint` — все зелёные.
- **Файлы:** `backend/package.json`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260524192718_init/migration.sql`, `backend/prisma/migrations/migration_lock.toml`, `backend/lib/db.ts`, `docs/ROADMAP.json` (ent-users, ent-profile → in_progress).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`
- **Заметка:** Status `done` для ent-users/ent-profile поставим после применения миграции к живому Postgres в следующей итерации (docker-compose).

---

## 2026-05-24 — Phase 0 / шаг 3: Worker (node-cron) скелет

- **Сделано:** создал `worker/` workspace: чистый Node.js + TypeScript (NodeNext ESM) + node-cron + pino. `src/index.ts` стартует процесс, логирует pid+node version, регистрирует minute-heartbeat cron (debug-уровень), обрабатывает SIGTERM/SIGINT с graceful shutdown (stop cron → 500ms grace → exit 0). Билд: tsc → `dist/index.js`. Dev-режим: `tsx watch`.
- **Решение:** worker = отдельный workspace без Next.js / React / Prisma пока. Prisma подключим вместе с первой миграцией (следующая итерация). Логи — pino JSON в stdout (Docker сам подхватит в `journalctl`).
- **Проверки:** `npm install` OK, `npx tsc --noEmit` clean, `npx tsc` (build) → `dist/index.js`, `node dist/index.js` запустился и при SIGTERM показал лог-цепочку `worker started → shutdown requested → worker stopped`. ESLint clean.
- **Файлы:** `worker/package.json`, `worker/tsconfig.json`, `worker/src/index.ts`, `worker/eslint.config.mjs`, `worker/.prettierrc.json`, `worker/.env.example`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 0 / шаг 2: Frontend (Vite + React) скелет

- **Сделано:** создал `frontend/` workspace: Vite 6 + React 19 + TypeScript strict + SCSS modules + React Router v7. Структура: `package.json`, project-references `tsconfig.json` (`.app.json` для src, `.node.json` для vite.config), `vite.config.ts` с dev-proxy `/api → :3000`, `index.html`, `src/main.tsx` (createBrowserRouter + RouterProvider), `src/App.tsx` со ссылкой на `App.module.scss`, design tokens в `src/styles/variables.scss` (цвета, отступы, типографика, breakpoints), `reset.scss` (минимальный modern reset), `global.scss` (применение токенов к body). ESLint 9 flat config с react-hooks + react-refresh плагинами.
- **Решение:** Vite 6 (не 5) — текущий stable. Project references в tsconfig (`-b` build) — стандартный паттерн create-vite. Минимум зависимостей: только react / react-dom / react-router. TanStack Query, Zustand, RHF — добавятся, когда понадобится первый API-вызов / state / форма (Phase 2+).
- **Проверки:** `npm install` (319 пакетов в frontend, lockfile обновлён), `npx tsc --noEmit` (clean), `npx vite build` (39 modules, 541ms, dist/index.html + CSS + JS bundle), `npx eslint .` (clean).
- **Файлы:** `frontend/package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.module.scss`, `src/styles/{variables,reset,global}.scss`, `eslint.config.mjs`, `.prettierrc.json`, `.env.example`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 0 / шаг 1: Backend (Next.js) скелет

- **Сделано:** создал monorepo-структуру (npm workspaces в корне `package.json`, `.nvmrc=22`) и `backend/` с Next.js 15 App Router. Backend содержит: `package.json` (next@15, react@19, pino, zod), `tsconfig.json` (strict + noUncheckedIndexedAccess + noImplicitOverride), `next.config.ts`, ESLint 9 flat config (`eslint.config.mjs` с typescript-eslint), Prettier, `.env.example` со всеми будущими секретами (DATABASE_URL, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, APPLE_ID, и т.д.), минимальный `app/layout.tsx` (требование App Router), `app/api/health/route.ts` (GET → {status, time, version}).
- **Решение:** **npm + npm workspaces** вместо pnpm — на машине пользователя нет pnpm/corepack, npm 11 уже установлен, для текущего масштаба workspace-функциональности npm хватает. Можно мигрировать на pnpm позже без боли. Node `.nvmrc=22` (LTS, целевой Docker base image), хотя локально у пользователя 26.
- **Столкнулся:** (1) Next.js при первом build авто-дописал `allowJs: true` в tsconfig.json — оставил как есть (intentional). (2) ESLint ругался на `next-env.d.ts` (auto-generated) — добавил в ignores eslint config.
- **Проверки:** `npm install` (321 пакет, OK), `npx tsc --noEmit` (no errors), `npx next build` (Compiled successfully, /api/health зарегистрирован как dynamic route), `npx eslint .` (clean).
- **Файлы:** `package.json`, `package-lock.json`, `.nvmrc`, `backend/package.json`, `backend/tsconfig.json`, `backend/next.config.ts`, `backend/eslint.config.mjs`, `backend/.prettierrc.json`, `backend/.env.example`, `backend/app/layout.tsx`, `backend/app/api/health/route.ts`, `backend/next-env.d.ts`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Назначены фазы 0–6 и приоритеты всех 37 фичей

- **Сделано:** заполнил `docs/PLAN.md` конкретными фазами 0–6 со списками `feature_id`, целями, acceptance-criteria и открытыми вопросами. Проставил `phase`/`priority`/`needed_now` для всех 37 фичей в `docs/ROADMAP.json`. Распределение: Phase 0=2, 1=9, 2=6, 3=7, 4=4, 5=6, 6=3. По приоритету: P0=20, P1=7, P2=10. `needed_now=true` — только у Phase 0 (старт). Добавил `.gitignore` правила для node/env/iteration-scratch.
- **Решение:** group-by по 4 уточнённым вопросам (AskUserQuestion): `ent-health-records` → Phase 3; парсеры — только 5К как P0, остальные P2 в той же Phase 1; UI-редакторы (`scr-edit-rules`, `scr-edit-schedule`) — рядом со своей сущностью (вертикальный slicing); `scr-correct-plan` → Phase 5.
- **Файлы:** `docs/ROADMAP.json`, `docs/PLAN.md`, `docs/HISTORY.md`, `.gitignore`
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Инициализация документации проекта

- **Сделано:** создана 4-файловая система документации в `App/docs/`:
  - `ROADMAP.json` (уже был, обновлён стек)
  - `ARCHITECTURE.md` (создан, полный контракт системы)
  - `PLAN.md` (создан, скелет фаз)
  - `HISTORY.md` (создан, эта запись)
- **Решение:** разделил backend (Next.js — только API + worker) и frontend (Vite/React SPA). Styling — SCSS modules вместо Tailwind/shadcn (явное решение пользователя на простой стек). ORM — Prisma (выбор между Prisma и Drizzle).
- **Также:** обновлён `App/CLAUDE.md` с обязательными правилами для AI-агента — всегда читать 4 документа и обновлять `HISTORY.md` после каждой итерации.
- **Файлы:** `App/CLAUDE.md`, `App/docs/ARCHITECTURE.md`, `App/docs/PLAN.md`, `App/docs/HISTORY.md`, `App/docs/ROADMAP.json` (stack section update).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — ROADMAP заполнен фичами (16 entities + 18 scripts)

- **Сделано:** разобрал рукописные заметки пользователя, обсудил критически концепцию, добавил недостающее (Каталог ингредиентов, План недели, История заказов, Пользователи), разделил «Состояние человека» на `profile` + `health_records`, объединил релевантные+одобренные рецепты в одну таблицу со status-флагами.
- **Решение:** структура — плоский список фичей с полем `phase` (TBD), полная детализация, поля `kind` (entity/script) и `module` (Поиск/Валидация/Расчёт/Сопровождение).
- **Файлы:** `App/docs/ROADMAP.json`
- **Коммит:** `7a3b2b4`
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — TBD стека закрыты, добавлен агентный слой (+3 фичи)

- **Сделано:** зафиксированы все TBD-решения по стеку. Добавил 2 entity (`ent-telegram-account`, `ent-agent-conversations`) и 1 script (`scr-telegram-agent` — LLM-агент с tool-use доступом ко всем 16 CRUD-скриптам). Переименовал `scr-notifications` → «Push Apple Reminders (CalDAV)». Зафиксировал политику clean slate (без импорта старых данных) и еженедельный парсинг.
- **Решение:** нотификации идут через **Apple Reminders + CalDAV** (см. `arc.md` секция A). Telegram = **двусторонний LLM-агент** через grammY + Claude API (не нотификационный канал). Деплой — Self-host VPS + Docker. API — REST.
- **Файлы:** `App/docs/ROADMAP.json`
- **Коммит:** `4e8abaf`
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — ROADMAP создан (пустой шаблон)

- **Сделано:** создал `docs/ROADMAP.json` с пустым массивом `features: []`, описанием словарей (status/priority/complexity) и шаблоном `feature_schema`.
- **Решение:** структура — flat features[], полная детализация на фичу, формат `roadmap_v1`.
- **Файлы:** `App/docs/ROADMAP.json`
- **Коммит:** `01a055e`
- **Ветка:** `rework/nextjs-postgres` (создана от main)

---

## 2026-05-24 — Git инициализирован, baseline-коммит

- **Сделано:** инициализировал git в `App/`, переименовал ветку в `main`, добавил `output/.gitkeep`, сделал первый коммит со всем существующим Python-приложением (42 файла, 6821 строка).
- **Решение:** git scope — внутри `App/` (не корня проекта), main ветка считается «продакшеновой и заблокированной» от изменений в rework.
- **Файлы:** все файлы `App/` baseline
- **Коммит:** `0407adf`
- **Ветка:** `main` (только что создана)
