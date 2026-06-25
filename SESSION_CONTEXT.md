# 🧭 Контекст для свежей сессии агента

> Краткий хендофф: где мы сейчас, какие решения приняты, правила и пожелания.
> Полные источники правды: `docs/ARCHITECTURE.md` (контракт), `docs/ROADMAP.json` (фичи),
> `docs/PLAN.md` · `docs/HISTORY.md` · `docs/PROGRESS.md`, `AGENTS.md` (gotchas), `README.md` (как запускать).

## Что это
Рерайт приложения подбора питания. Ветка **`rework/nextjs-postgres`** (НЕ трогать `main` — там legacy Python/CLI).
Monorepo (npm workspaces): `core` (Prisma + логика) · `backend` (Next.js REST) · `frontend` (Vite+React+Tailwind/Untitled UI SPA) · `worker` (cron) · `llm-service` (pg-boss + LLM-адаптер).
Все 37 фич ROADMAP = `done`.

## Текущее состояние
- **Web SPA** (`:5173`) с разделами: `/plan` (генерация+просмотр), `/recipes` («Блюда» — пул рецептов), `/diary` (дневник), `/stock` (остатки + редактор инвентаризации), `/cart` (корзина по магазинам + заказы), `/rules` (КБЖУ+бюджет+тег-правила), `/agent` (чат с LLM-агентом + история). Верхняя навигация — `frontend/src/app-layout.tsx`.
- **Backend REST** (`:3000`): эндпоинты на каждый раздел (`/api/...`), + `/api/agent/message|history`, `/api/telegram/link|webhook`, `/api/stock-items`, `/api/recipes[/:id]`, `/api/tags`.
- **LLM-агент**: transport-agnostic `core/src/agent/` (реестр инструментов `AGENT_TOOLS` → scr-* сервисы + `handleAgentMessage`). Один и тот же мозг обслуживает web `/agent` и Telegram-бота.
- **Telegram-бот** `@ayyyyaaaa_bot`: grammY, webhook (прод) / polling (`backend/scripts/telegram-polling.ts`, dev). Линковка через одноразовый токен (`/start <token>`).
- **Демо-данные**: идемпотентный сид `core/prisma/seed.ts` (`npm run seed --workspace core`). Демо-юзер `demo@meal.local` (backdated → «текущий», auth отложена). Есть вспом. prisma-скрипты: `recipe-pipeline.ts`, `fill-recipes.ts`, `fix-excluded-products.ts`, `normalize-portions.ts`, `plan-report.ts`.
- **Тесты**: core (vitest, ~126+) + frontend (vitest+jsdom+testing-library). Линт/типчек/билды зелёные (см. README блок проверок).

## Ключевые решения
- **LLM по умолчанию = STUB** (`LLM_MODE=stub`, фикстуры `llm-service/src/fixtures/*.json`). Реальный Claude — `LLM_MODE=api` + `ANTHROPIC_API_KEY` (адаптер — backlog). Generic-клиент: `core/src/recipes/llm-client.ts` `runLlmJob`.
- **Stub-first** для всех внешних зависимостей (LLM, Telegram, CalDAV, парсеры магазинов) — реальные интеграции требуют кредов.
- **UI — только компоненты Untitled UI** (Tailwind v4 + React Aria), без хардкода. Формы — `Input`/`Button`/`TextArea`, React Query для данных.
- **Single-user dev**: «текущий» юзер = самый ранний по `createdAt` (`useCurrentUser` → `items[0]`). Полноценный auth отложен.
- **Telegram в РФ заблокирован напрямую** → бот ходит через прокси из `HTTPS_PROXY` (node-fetch `agent`, `backend/lib/telegram-bot.ts botClientConfig`). curl видит Telegram, Node по умолчанию — нет.
- **Диетические правила** (из `nutrition_norms.json`/`menu_rules.md`, ветка main) кодируются в `core/src/validation/`: `ban-keywords.ts` (§13a — напр. гречка исключена, замена рис/макароны/картофель), `evaluate-rules.ts`, `plan/rules.ts`. Рецепты-нарушители демотируются из одобренного пула (`isApproved=false` + `rejectionReasons`), чтобы reseed не возвращал запрещённое.
- **Цели КБЖУ** согласованы с `calcNorms` (белок ~1.8 г/кг, жир ~0.8 г/кг, углеводы — остаток).
- Генерация плана: LLM-черновик (`calc-plan`) → greedy-resolve в пул одобренных рецептов (`core/src/plan/greedy.ts`).

## Правила (обязательные)
- **`main` — заблокирована** (прод legacy). Не трогать; можно читать.
- **Git identity — только инлайн** (`git -c user.email=... -c user.name=...`), НЕ менять глобально. Коммитить/пушить — только по просьбе пользователя.
- **НЕ коммитить** `.claude/ralph-loop.local.md`; `.claude/launch.json` — локальный конфиг превью.
- **`docs/` — не создавать новые .md** сверх ARCHITECTURE/ROADMAP/PLAN/HISTORY/PROGRESS/RALPH_* (политика). Этот файл — в корне намеренно.
- `docs/ARCHITECTURE.md` — менять только при крайней нужде + фиксировать в `HISTORY.md`.
- После значимой итерации обновлять `HISTORY.md` / `ROADMAP.json` / `PLAN.md` / `PROGRESS.md`.
- Перед Edit — Read файла (харнесс требует). Decimal-поля Prisma приходят в JSON строками — `Number(...)`.

## Пожелания / в работе
- **WIP (не закоммичено, см. `git status`)**: recipe-pipeline + ban-keywords (§13a) + улучшения greedy/plan/normalization/prompts. Прогнать тесты перед коммитом.
- Подключить **реальный Anthropic API** (реализовать `AnthropicAdapter`, `LLM_MODE=api`) — чтобы агент думал, а не отдавал фикстуру.
- Реальный **Telegram webhook** (нужен публичный HTTPS) вместо polling.
- Реальные **CalDAV** (Apple Reminders) и **парсеры магазинов** (5ka/Цех/ЛЛ/ВВ).

## ⚠️ Безопасность
- Пользователь прислал **живой токен бота `@ayyyyaaaa_bot` в открытом виде** в чате. **Перевыпустить через @BotFather `/revoke`.** Токен в файлы не сохранён (только в командах запуска).

## Запуск
См. `README.md` → «Быстрый старт»: docker postgres → миграции → `npm run seed --workspace core` → `llm:start` → backend → `frontend dev` → (опц.) telegram polling.
