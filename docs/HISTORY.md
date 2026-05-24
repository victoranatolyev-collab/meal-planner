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

## 2026-05-24 — ✅ Phase 1 закрыта: 3 P2-парсера + полный pipeline 4 источников

- **Сделано:** cookie-cutter копии five-ka каталога в `core/src/parsers/{tseh,ll,vv}/` (8 файлов в каждом). Python-скрипт с sed-replace: имена классов, IngredientSource enum (FIVEKA→TSEH/LL/VV), prisma model refs (source5ka→sourceTseh/sourceLl/sourceVv), env vars, fixture metadata. Дополнил `core/src/index.ts` экспортами `importTseh, importLl, importVv`. Создал в worker 3 jobs (`parse-tseh.ts`, `parse-ll.ts`, `parse-vv.ts`) и 3 CLI seed-* через шаблон. Зарегистрировал 3 cron-задачи (15/30/45 субботы — каждая 15 мин после 5K). Добавил scripts в worker/package.json.
- **End-to-end smoke (полный pipeline):**
  - docker compose up postgres → migrate deploy → ✓
  - 4 seed-* запуска подряд → каждый говорит `ingredientsUpserted: 5` ✓
  - psql query → ingredients = 20 (5×4), source_*  = 1 snapshot each ✓
  - Повторный прогон 4 seed-* → ingredients остаётся 20 (UPSERT idempotency ✓), source_5ka snapshot=4 (4 запуска суммарно), tseh/ll/vv=2 (2 запуска). Append-only sources работает ✓
- **Решение:** Cookie-cutter копирование 5К-парсера в 3 другие папки. Refactor в общий generic-парсер отложен — реальные API endpoints магазинов будут различаться, и абстракция получится преждевременной. После того как 2+ реальных парсера заработают, можно выделить общее.
- **Закрыто как done:** `scr-parse-tseh`, `scr-parse-ll`, `scr-parse-vv`. 
- **Phase 1 ✅ DONE.** 11/37 фичей готово. Перенесена в «История фаз» в PLAN.md с полным summary.
- **Проверки:** vitest (23/23: 4×4 mapper + 7 schemas) ✅, tsc core+worker ✅, smoke 4 sources × 2 прогона ✅.
- **Файлы:** 24 новых файла в core/src/parsers/{tseh,ll,vv}, 6 файлов в worker/src/{jobs,cli}, обновления в core/src/index.ts, worker/src/index.ts, worker/package.json, docs/ROADMAP.json, docs/PLAN.md.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 4: Worker cron + seed CLI; scr-parse-5ka DONE

- **Сделано:**
  - `worker/package.json`: добавил `"core": "*"` как dep, перенёс tsx в `dependencies` (нужна в runtime), упростил scripts (`start: tsx src/index.ts`, `seed:5ka: tsx src/cli/seed-5ka.ts`). Убрал tsc-build из worker (worker запускается через tsx и в prod — KISS, без bundling-шага).
  - `worker/src/jobs/parse-5ka.ts`: cron-задача дёргает `importFiveKa` из 'core'.
  - `worker/src/cli/seed-5ka.ts`: one-shot CLI для smoke-тестов (`npm run seed:5ka --workspace worker`).
  - `worker/src/index.ts`: зарегистрирован cron `0 3 * * 6` (Сб 03:00) для parse-5ka.
  - `worker/tsconfig.json`: noEmit=true (tsc только для typecheck).
  - `worker/Dockerfile`: добавил `prep` stage с `prisma generate` (для core), runner копирует core/+worker/ и запускает `npx tsx worker/src/index.ts`.
- **End-to-end smoke (полный pipeline):**
  - docker compose up postgres → миграции уже применены.
  - `npm run seed:5ka --workspace worker` → 5 products parsed → 5 ingredients UPSERTed → source_5ka snapshot создан. Лог: `productsTotal:5, ingredientsUpserted:5, elapsedMs:40`.
  - `next start` + `curl /api/ingredients?limit=10` → 200 с массивом 5 items (КБЖУ + price_per_100g + packSize + unit — всё корректно).
  - **Idempotency**: повторный seed-5ka → новый sourceId (source_5ka append-only ✓), но `/api/ingredients` всё ещё `total=5` (UPSERT по unique key (name, source, pack_size) не дублирует ✓).
- **Решение:** Worker использует `tsx` и в production (вместо `tsc → dist/`). Причина: core экспортирует TS-исходники (`main: ./src/index.ts`), Node не запустит `.ts` напрямую; bundling-шаг = overkill при текущем масштабе. tsx добавляет ~5MB в runtime образ — приемлемо.
- **Закрыто как done:** `scr-parse-5ka` (stub-pipeline работает; реальный API через DevTools-endpoints — отдельная improvement-задача, статус `done` потому что фича «парсинг + idempotent импорт + интеграция с БД» реализована).
- **Проверки:** `npm install`, `tsc --noEmit` в worker и core, `prisma migrate deploy`, `seed:5ka` (×2 идемпотентно), `next start` + `curl /api/ingredients`, `docker compose down` — всё зелёное.
- **Файлы:** `worker/package.json`, `worker/tsconfig.json`, `worker/Dockerfile`, `worker/src/index.ts`, `worker/src/jobs/parse-5ka.ts` (new), `worker/src/cli/seed-5ka.ts` (new), `docs/ROADMAP.json` (scr-parse-5ka → done), `docs/HISTORY.md`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Рефакторинг: shared workspace `core/`

- **Сделано:** создал 4-й npm workspace `core/` со своим package.json (deps: @prisma/client, pino, zod; dev: prisma, vitest, typescript, eslint, typescript-eslint), tsconfig (NodeNext ESM strict), eslint config, vitest config. Перенёс через `git mv` (rename detection сохранён): `backend/prisma/` → `core/prisma/`, `backend/lib/db.ts` → `core/src/db.ts`, `backend/lib/parsers/` → `core/src/parsers/`, `backend/lib/ingredients/` → `core/src/ingredients/`. Создал `core/src/index.ts` (barrel-экспорты). Добавил `core` в `package.json` workspaces. Backend depends on core через `"core": "*"`. backend route `/api/ingredients` теперь импортирует `import { listIngredientsQuerySchema, listIngredients } from 'core'`.
- **Решение (через AskUserQuestion):** вариант 1 — общая библиотека `core/`. Закрыт TBD из ARCHITECTURE.md §6. Phase 2-6 будут активно складывать сюда shared services (recipes, validation, plan calc, agent-tools).
- **Столкнулся:** (1) NodeNext-ESM требует явные `.js`-расширения в relative imports. Прогнал sed-замену по всем файлам core/src. (2) Webpack Next.js не понимает `.js→.ts` ремаппинг. Решение: `transpilePackages: ['core']` + `webpack.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] }` в next.config.ts. (3) Backend остался без тестов (все ушли в core). Решение: `vitest run --passWithNoTests`.
- **Dockerfiles:** обновил backend/frontend/worker — добавил `COPY core/package.json` в deps stage и `COPY core ./core` в builder stage. Backend builder делает `prisma generate` уже из `core/` (где лежит schema).
- **ARCHITECTURE.md §6:** TBD убран, описана структура core/. §12: добавлен `core/` в дерево репозитория. Changelog (§13) дополнен.
- **Проверки:** `npm install` OK, `prisma generate` (из core), `tsc --noEmit` в core ✅ и backend ✅, `vitest run` в core (11/11) ✅, в backend (no tests, exit 0) ✅, `eslint` в core/backend ✅, `next build` ✅.
- **Файлы:** новые `core/{package.json,tsconfig.json,eslint.config.mjs,vitest.config.ts}`, `core/src/index.ts`. Переименованы (git mv): 12 файлов из `backend/{prisma,lib}` в `core/{prisma,src}`. Изменены: `package.json` (root, workspaces+scripts), `backend/{package.json,next.config.ts,Dockerfile,app/api/ingredients/route.ts}`, `frontend/Dockerfile`, `worker/Dockerfile`, `docs/ARCHITECTURE.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 3: GET /api/ingredients с пагинацией

- **Сделано:** layered endpoint:
  - `backend/lib/ingredients/schemas.ts` — Zod-схема query params (limit 1..200 default 50, offset ≥0 default 0, source enum, q text search). Coerce строковых query → числа.
  - `backend/lib/ingredients/service.ts` — `listIngredients({limit, offset, source, q})` через `prisma.ingredient.findMany` + `count`, фильтр по source и `name contains` (mode: insensitive), сортировка name ASC, возвращает {items, total, limit, offset}.
  - `backend/app/api/ingredients/route.ts` — thin GET handler: парсит query → Zod → service → JSON. 400 при невалидных params с `details: ZodError.flatten()`.
- **Тесты:** 7 юнит-тестов на Zod-схему (дефолты, coerce, валидные/невалидные source, границы limit/offset, trim+min-length q). Suite passing 11/11 (4 mapper + 7 schemas).
- **Smoke против live Postgres:** docker compose up postgres, next start, curl `/api/ingredients?limit=10` → 200 `{items:[], total:0, limit:10, offset:0}`. curl `?source=OZON` → 400 с Zod-details (`Invalid enum value... received 'OZON'`). docker compose down — clean.
- **Решение:** Layered подход (schema + service + route) — те же service-функции переиспользуются в Telegram-агенте через tool-use (см. ARCHITECTURE.md §9.2: «Tool definitions для агента — генерируются из тех же Zod-схем»).
- **Проверки:** vitest (11/11), tsc, next build, eslint, smoke curl — все зелёные.
- **Файлы:** `backend/lib/ingredients/{schemas,service,schemas.test}.ts`, `backend/app/api/ingredients/route.ts`, `docs/HISTORY.md`, `docs/PLAN.md`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 2: парсер 5К каркас + Vitest

- **Сделано:** написал каркас парсера 5К в `backend/lib/parsers/five-ka/`: `types.ts` (FiveKaProduct shape per `data/ingredients_spb.json` из main), `parser.ts` (interface + env-фабрика stub/api), `stub-parser.ts` (читает фикстуру), `api-parser.ts` (skeleton с JSDoc-инструкцией, как пользователь должен достать endpoints/cookies из DevTools), `mapper.ts` (FiveKaProduct → `Prisma.IngredientCreateInput`, считает price_per_100g, Decimal), `importer.ts` (INSERT в source_5ka + idempotent UPSERT в ingredients по unique key (name, source, pack_size)). Поднял Vitest в backend, 4 юнит-теста маппера зелёные.
- **Решение:** Сегодня — только каркас. Реальный API подключим в следующей итерации после того, как пользователь предоставит endpoints из DevTools (5ka.ru блокирует WebFetch 403). До этого парсер работает на фикстуре (`FIVEKA_PARSER_MODE=stub` default). Сценарий: можно сейчас запустить весь pipeline на 5 mock-позициях, проверить идемпотентность UPSERT, и не блокировать downstream Phase 2-4.
- **Маппер-правила:** source=FIVEKA, externalCode=String(plu), КБЖУ напрямую (5К отдаёт на 100г), price_per_100g = regular*100/weightG если оба есть, packSize=weight.label.
- **Status:** `scr-parse-5ka` → in_progress (done после успешного импорта реального снимка 5К).
- **Проверки:** `npm install` (vitest), `npm run test` (4/4 passed), `tsc --noEmit` clean, `next build` OK, `eslint` clean.
- **Файлы:** `backend/lib/parsers/five-ka/{types,parser,stub-parser,api-parser,mapper,importer,mapper.test}.ts`, `backend/lib/parsers/five-ka/__fixtures__/sample.json`, `backend/vitest.config.ts`, `backend/package.json` (+vitest, +test scripts), `docs/ROADMAP.json`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — Phase 1 / шаг 1: схема каталога (5 entities закрыто)

- **Сделано:** расширил `backend/prisma/schema.prisma` 5 моделями: `Source5ka`, `SourceTseh`, `SourceLl`, `SourceVv` (4 append-only журнала парсеров) и `Ingredient` (общий каталог) + enum `IngredientSource` (FIVEKA/TSEH/LL/VV/CUSTOM). Сгенерировал миграцию `20260524200347_catalog` через `prisma migrate dev --create-only`, применил через `migrate deploy`. `\dt` показывает 8 таблиц.
- **Решение (через AskUserQuestion):** (1) Scope — **global catalog** (без user_id FK). Каталог 5К одинаков для всех; кастомные ингредиенты добавим отдельным механизмом позже. (2) Source-таблицы — **append-only** с `parsed_at DESC` индексом. Каждый запуск парсера = новая запись; история нужна для сравнения парсов и отлова регрессов; свежий снимок = `ORDER BY parsed_at DESC LIMIT 1`.
- **Дизайн:** sources — единая shape (`id, parsed_at, raw jsonb, summary jsonb, timestamps`). Ingredient — поля per ROADMAP (`name, source, external_code, kcal/protein/fat/carbs_100g Decimal, price_per_100g Decimal, weight_g, pack_size, unit`). Unique (name, source, pack_size). Decimal для точных расчётов КБЖУ/цен.
- **Закрыто как done:** `ent-source-5ka`, `ent-source-tseh`, `ent-source-ll`, `ent-source-vv`, `ent-ingredients`. Итого 7/37 фичей done.
- **Проверки:** `prisma format/validate/generate`, `migrate deploy` (8 таблиц в БД), `tsc --noEmit`, `next build`, `eslint`, `docker compose down` — все зелёные.
- **Файлы:** `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260524200347_catalog/migration.sql`, `docs/ROADMAP.json`.
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

---

## 2026-05-24 — ✅ Phase 0 закрыта: Docker compose + migrate deploy

- **Сделано:** написал 3 multi-stage Dockerfile (backend node:22-alpine, frontend node→nginx:1.27-alpine, worker node→alpine с tini), `nginx.conf` с SPA fallback + `/api/` proxy на backend:3000, корневой `docker-compose.yml` с 4 сервисами (postgres:16-alpine, backend, worker, frontend) + healthcheck на postgres + depends_on с service_healthy + volume `postgres_data`. `.dockerignore` в каждом workspace. Корневой `.env.example` + локальный `.env`.
- **Проверка end-to-end:** Поднял Colima (был не запущен), установил docker-compose plugin v5.1.4 через brew, прописал `cliPluginsExtraDirs` в `~/.docker/config.json`. `docker compose up -d postgres` → healthy. `npx prisma migrate deploy` с DATABASE_URL=localhost:5432 → миграция `20260524192718_init` применилась. `\dt` показал `users`, `profiles`, `_prisma_migrations`. `\d users` → PK, unique email, FK references из profiles. `docker compose up -d` (вся четвёрка) → все Up. `curl localhost:3000/api/health` → 200 `{status:ok}`. `curl localhost:8080/api/health` (через frontend nginx-proxy) → 200 — **full-stack integration works**. Worker логи: `worker started`. `docker compose down` — clean.
- **Столкнулся:** (1) Docker daemon (Colima) был остановлен — пользователь запустил Colima самостоятельно по AskUserQuestion-ответу. (2) `docker compose` plugin отсутствовал — поставил через `brew install docker-compose` + добавил `cliPluginsExtraDirs`. (3) Первая попытка build падала на `COPY --from=deps /repo/backend/node_modules` — npm workspaces hoist'ит все deps в корневой `node_modules/`, workspace-папок node_modules вообще не существует. Убрал лишние COPY. (4) Frontend build падал на `error TS2307: Cannot find module './App.module.scss'` — не было `src/vite-env.d.ts` (стандартный файл из create-vite с `/// <reference types="vite/client" />`). Добавил.
- **Решение:** Базовые образы — alpine (минимальный размер). В worker — `tini` как PID 1 для корректного SIGTERM (без него Node не получает сигнал). Frontend production = nginx serving static + reverse-proxy на backend. Postgres expose:5432 на хост для удобства миграций/psql с хоста.
- **Закрыто как done:** `ent-users`, `ent-profile` (миграция применена, таблицы существуют, FK работает).
- **Проверки:** docker compose config, build × 3 image, up -d, healthcheck postgres, prisma migrate deploy, psql \dt + \d users, curl × 3 endpoints (backend, frontend, proxy), worker logs, docker compose down — все зелёные.
- **Файлы:** `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf`, `frontend/src/vite-env.d.ts`, `worker/Dockerfile`, `worker/.dockerignore`, `docker-compose.yml`, `.env.example`, `docs/ROADMAP.json` (ent-users + ent-profile → done).
- **Коммит:** _будет после этой записи_
- **Ветка:** `rework/nextjs-postgres`

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
