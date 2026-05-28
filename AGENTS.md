# AGENTS.md — паттерны и gotchas проекта

> Это **knowledge base** для AI-агента (Claude Code, Ralph Loop, и т.д.).
> AI читает этот файл в КАЖДОЙ итерации, чтобы помнить паттерны и не наступать на грабли.
> Обновляется по ходу работы: когда узнаёшь что-то важное — добавь сюда.

## Архитектура (одной строкой)

Monorepo на npm workspaces: 5 контейнеров (postgres, backend, worker, frontend, llm-service) + 5 workspaces (`core/`, `backend/`, `frontend/`, `worker/`, `llm-service/`). Бизнес-логика → `core/`. Контракт целиком — `docs/ARCHITECTURE.md`.

## 4 документа источников правды (читай ПЕРЕД работой)

1. **docs/ARCHITECTURE.md** — контракт системы. Менять только при крайней необходимости с записью в HISTORY.
2. **docs/ROADMAP.json** — фичи + статусы (`planned`/`in_progress`/`done`). 37 штук всего.
3. **docs/PLAN.md** — фазы (0–6) с привязкой feature_id.
4. **docs/HISTORY.md** — журнал итераций (append-only, новые записи сверху).

После каждой значимой итерации обнови HISTORY + ROADMAP статусы + PLAN.

## Жёсткие правила

- **main branch заблокирована.** Работа только в `rework/nextjs-postgres`.
- **Никогда не править git config глобально.** Для commit использовать `-c user.email=... -c user.name=...` inline.
- **Никаких --no-verify**, --amend (если уже коммитили), --force-push.
- **Коммиты мелкие, фокусированные.** Один логический шаг → один коммит.
- **При неоднозначности — AskUserQuestion.** Не выдумывай решения.

## Технический стек (по слоям)

| Слой | Стек |
|---|---|
| Backend | Next.js 15 (App Router), TypeScript strict, Prisma, Zod, pino |
| Frontend | Vite 6 + React 19 + SCSS modules + React Router v7 |
| Worker | Node 22 + node-cron + tsx (runtime, **не** tsc-bundle) |
| LLM-service | Hono + pg-boss + Adapter pattern (Anthropic/OpenAI/Stub) |
| DB | PostgreSQL 16 + pg_trgm + GIN индексы |
| Core | TypeScript NodeNext ESM, единая Zod-схема для REST + agent tools |
| Тесты | Vitest (core, backend) |
| Deploy | Docker compose (5 контейнеров) |

## Workspace мапа (где что искать)

```
core/src/
├── db.ts                    # PrismaClient singleton
├── parsers/{five-ka,tseh,ll,vv}/  # Парсеры магазинов (stub-first)
├── ingredients/             # Service + Zod schemas
├── normalization/           # pg_trgm fuzzy match + unit conversions
└── validation/              # Tag-based rule engine

backend/app/api/<resource>/route.ts  # Thin Route Handlers
frontend/src/                       # UI (Phase 2+ конец каждой фазы)
worker/src/{jobs,cli}/              # Cron + manual seeders
llm-service/src/                    # Hono + pg-boss + adapters
```

## Tag-based архитектура правил (центральная!)

Все правила питания пользователя = строки в `tag_rules` с `rule_kind`:
- `BAN_TAG` — нельзя ингредиент с тегом
- `BAN_TAG_IN_MEAL` — нельзя в рецептах с `meal_tag`
- `REQUIRE_TAG_IN_MEAL` — обязательно в рецептах с `meal_tag`
- `MIN_PER_WEEK` / `MAX_PER_WEEK` — week-level, **не** проверяется в recipe validator

Ингредиенты несут `tags text[]` (GIN индекс). Рецепты несут `recipe_tags` junction.

Валидатор = чистые SQL-выборки по тегам. См. ARCHITECTURE §7.3.

## LLM policy (когда работа касается scr-search-recipes / scr-calc-week-plan / scr-telegram-agent)

- Код LLM-вызовов **только в `llm-service/`**, не в core/backend.
- Backend дёргает llm-service через HTTP (см. ARCHITECTURE §10.4).
- Каждый ответ Claude **обязательно валидируется Zod-схемой** перед записью в БД.
- Retry: 429 → backoff (1s/2s/4s), schema fail → re-prompt (max 2).
- Cost tracking в `llm_jobs` audit table.

## Команды-проверки (mechanical verification)

Перед коммитом — все три должны быть зелёные:

```bash
# Tests
npm run test --workspace core           # vitest 41+ tests
npm run test --workspace backend        # vitest --passWithNoTests

# Typecheck
npm run typecheck --workspace core
npm run typecheck --workspace backend
npm run typecheck --workspace worker
npm run typecheck --workspace llm-service

# Build (где есть)
npm run build --workspace backend       # next build
npm run build --workspace frontend      # vite build

# Lint
npm run lint --workspace core
npm run lint --workspace backend
```

Smoke (если меняется БД-логика):
```bash
docker compose up -d postgres
npm run prisma:migrate:deploy --workspace core
npm run seed:5ka --workspace worker     # наполнить ingredients
docker compose down
```

## Gotchas (горький опыт — не повтори)

### 1. NodeNext ESM требует `.js` в relative imports
TS-конвенция: `import { x } from './foo.js'` (TypeScript автоматически резолвит `.ts`). Без этого core/worker/llm-service не компилятся через tsc.

### 2. Next.js webpack ↔ NodeNext interop
Backend (Next.js) не понимает `.js` imports из core. Нужен `transpilePackages: ['core']` + `webpack.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] }` в `backend/next.config.ts`.

### 3. npm workspaces hoist
`npm ci` хоистит deps в **корневой `node_modules/`**. Workspace-папок `<ws>/node_modules` обычно нет. Не пытайся копировать их в Dockerfile.

### 4. pg-boss 10 требует createQueue
`boss.send(queueName)` упадёт если не делали `boss.createQueue(queueName)` ранее. Регистрируй очередь до первого send.

### 5. Prisma не умеет inline GIN/pg_trgm
Расширения и GIN-индексы добавляй **вручную в migration.sql** после `prisma migrate dev --create-only`. Пример: `CREATE EXTENSION pg_trgm; CREATE INDEX X USING GIN(name gin_trgm_ops)`.

### 6. Worker runtime — tsx, не node
`worker/Dockerfile` CMD = `npx tsx src/index.ts`. Не было `tsc → dist/` — core экспортирует TS-исходники.

### 7. .iteration-plan.md одноразовый
Создаётся в начале каждой итерации, удаляется **перед коммитом**. В .gitignore.

### 8. Plans/ legacy — gitignored
Старые `plans/week_*.json` от Python-app не нужны в rework-ветке. В .gitignore.

### 9. Идемпотентность парсеров через DB
UNIQUE `(name, source, pack_size)` в `ingredients`. Парсер делает UPSERT. Повторный запуск не дублирует.

### 10. Source-таблицы append-only
`source_5ka/tseh/ll/vv` — каждый парс = новая строка (история). Свежий снимок = `ORDER BY parsed_at DESC LIMIT 1`.

### 11. llm-service `/wait` гонка: audit создаётся лениво
Запись в `llm_jobs` (audit, ключ `pgBossJobId`) создаётся в `handleJob` при **pickup'е** job воркером, а НЕ при enqueue. Поэтому `POST /jobs/:id/wait` не должен отвечать 404 на первое отсутствие записи — в окне между enqueue и pickup `audit==null` это нормальное **pending**-состояние. Wait продолжает poll до deadline; bogus id → TIMEOUT 408. (Фикс 2026-05-28.)

### 12. core → llm-service по HTTP + generic Zod-возврат
`core` МОЖЕТ ходить в llm-service по HTTP (`core/src/recipes/llm-client.ts`) — это вызов через сеть, не импорт (llm-service зависит от core, не наоборот). Схемы дублируются на обеих сторонах границы намеренно (каждая валидирует независимо). Generic: пиши `runLlmJob<S extends ZodTypeAny>(...): Promise<z.infer<S>>`, НЕ `<T>(schema: ZodSchema<T>)` — при `.default()`/`.optional()` Input и Output типы Zod расходятся, а `ZodSchema<T>` их коллапсит и ломает вывод типа (mealTags стало бы `string[] | undefined`).

## Стратегия фаз

- **Phase 0** Foundation ✅
- **Phase 1** Catalog ✅
- **Phase 2** Recipes (текущая, 4/6 done)
- **Phase 3** Plan (расчёт КБЖУ + week_plan)
- **Phase 4** Procurement (cart + orders)
- **Phase 5** Tracking (diary + notifications)
- **Phase 6** Agent (Telegram)

**UI strategy:** backend-first. Frontend рисуется одной итерацией **в конце каждой Phase**.

## Когда задавать вопросы пользователю

- Выбор библиотеки/инструмента (если не очевидно из ARCHITECTURE)
- Структурные дизайн-решения (схема БД, контракты API)
- Внешние зависимости (есть ли API key, доступ)
- Тестирование стратегия (mock vs integration)

Используй **AskUserQuestion** с 2-4 опциями. Группируй до 4 вопросов в одном вызове.
