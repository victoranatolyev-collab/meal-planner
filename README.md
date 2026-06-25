# 🍽 Meal Planner — Rework (Next.js + Vite + Postgres)

Персональный подбор питания: план недели, дневник, остатки, заказы, правила КБЖУ и
LLM-агент (web-чат + Telegram) с доступом ко всем функциям.

> Ветка `rework/nextjs-postgres` — полный рерайт. Старое Python/CLI-приложение — в ветке `main`.
> Контракт системы — `docs/ARCHITECTURE.md`; дорожная карта — `docs/ROADMAP.json`.

---

## Стек

| Слой | Технология |
|---|---|
| Backend | Next.js (App Router) — REST API |
| Frontend | React + Vite + TypeScript + Tailwind v4 (Untitled UI) — SPA |
| Shared core | `core/` — Prisma + бизнес-логика (переиспользуется backend/worker/llm-service) |
| DB | PostgreSQL 16 + Prisma |
| LLM | микросервис `llm-service` (pg-boss + adapter); **stub** по умолчанию, реальный Anthropic — opt-in |
| Telegram | grammY (webhook в проде / polling в dev) |

Monorepo (npm workspaces): `core` · `backend` · `frontend` · `worker` · `llm-service`.

---

## 🚀 Быстрый старт (локально)

```bash
export DATABASE_URL="postgresql://meal:meal@localhost:5432/meal_planner"

# 1. Postgres
docker compose up -d postgres

# 2. Миграции + демо-данные (демо-пользователь, ингредиенты, рецепты, остатки, дневник)
npm run core:prisma:migrate:deploy
npm run seed --workspace core

# 3. LLM-сервис (stub: фикстуры вместо реального Claude)
LLM_MODE=stub npm run llm:start          # → :3001

# 4. Backend (REST API)
npm run build --workspace backend && npm run start --workspace backend   # → :3000
#   или для разработки: npm run backend:dev

# 5. Frontend (SPA)
npm run dev --workspace frontend         # → http://localhost:5173

# 6. (опционально) План недели — генерируется отдельно (нужен llm-service):
curl -X POST localhost:3000/api/plans -H 'content-type: application/json' \
  -d '{"userId":"<id>","weekIso":"2026-W22","startDate":"2026-05-25"}'
```

Открой **http://localhost:5173**. «Текущий» пользователь — самый ранний в БД (auth отложена);
сид создаёт `demo@meal.local` с backdated датой, поэтому он выбирается автоматически.

### Telegram-бот (опционально)

```bash
# webhook нужен публичный HTTPS; для локали проще polling:
TELEGRAM_BOT_TOKEN=... npx tsx backend/scripts/telegram-polling.ts
```

В регионах, где `api.telegram.org` заблокирован, бот ходит через прокси из `HTTPS_PROXY`
(node-fetch `agent`). Токен — в `@BotFather`; после демо не забудь `/revoke`.

---

## ✨ Фичи (краткая инструкция)

Верхняя навигация ведёт по всем разделам. Все страницы работают с REST API (`/api/*`).

### 🗓 План недели — `/plan`
Генерация и просмотр плана питания на неделю.
- Укажи **неделю (ISO)** и **дату старта** (понедельник) → «Сгенерировать». Повторный запуск
  пересоздаёт план.
- Селектор недели переключает сохранённые планы; карточки дней показывают приёмы, время,
  теги и рецепты с коэффициентом порции.
- API: `POST /api/plans` (генерация), `GET /api/plans?userId[&weekIso]` (список/план).
- Внутри: LLM-черновик (`llm-service` `calc-plan`) → greedy-resolve в пул одобренных рецептов.

### 📓 Дневник — `/diary`
Учёт съеденного и суммарные КБЖУ.
- Заполни «Что съели» (+ опц. приём, порции, КБЖУ) → «Записать». Если задан рецепт, КБЖУ
  считаются из него × порции; для ad-hoc — вводятся вручную.
- Журнал показывает записи и сумму КБЖУ.
- API: `POST /api/diary`, `GET /api/diary?userId`.

### 📦 Остатки — `/stock`
Проекция остатков продуктов: `запас + закупки − съедено (по дневнику)`.
- Таблица по ингредиентам; отрицательный прогноз (дефицит) подсвечен красным ⚠.
- API: `GET /api/stock?userId` (+ `/api/ingredients` для имён).

### 🛒 Корзина и заказы — `/cart`
Сборка корзины из плана и оформление заказа.
- Укажи неделю → «Собрать корзину»: позиции группируются по магазинам с оценкой цены.
- «Оформить заказ» → заказы по магазинам, корзина закрывается; ниже — история заказов.
- API: `POST /api/cart/assemble`, `GET /api/cart?userId`, `POST /api/orders`, `GET /api/orders`.

### ⚖️ Правила питания — `/rules`
Целевые КБЖУ, недельный бюджет и тег-правила.
- Форма целей (ккал/Б/Ж/У, бюджет) → «Сохранить».
- Тег-правила: запрет тега, мин/макс приёмов в неделю, обязательный тег в приёме.
- API: `GET/PUT /api/nutrition-targets`, `GET/POST/PATCH/DELETE /api/tag-rules`.

### 🤖 Чат с агентом — `/agent`
LLM-агент с tool-use поверх всех `scr-*` сервисов (та же логика, что и в Telegram).
- Пиши на естественном языке; агент выбирает инструмент (`get_week_plan`, `get_stock`,
  `calc_norms`, `correct_plan`, `write_diary`), выполняет его и отвечает. Чипы показывают,
  какой инструмент сработал. История диалога восстанавливается при загрузке.
- API: `POST /api/agent/message`, `GET /api/agent/history?userId`.
- ⚠️ По умолчанию LLM — **stub** (фикстуры): ответ канонический, инструмент `get_stock`.
  Реальный Claude — `LLM_MODE=api` + `ANTHROPIC_API_KEY` (backlog).

---

## 🧪 Тесты и проверки

```bash
npm run core:test                 # unit (core, vitest) — 126 тестов
npm run test --workspace frontend # frontend (vitest + jsdom + testing-library)
npm run core:typecheck && npm run backend:typecheck && npm run typecheck --workspace frontend
npm run core:lint && npm run backend:lint && npm run lint --workspace frontend
npm run build --workspace frontend && npm run build --workspace backend
```

---

## 📌 Что на заглушках (нужны ключи/доступы — backlog)

- **LLM**: реальный Anthropic-адаптер (сейчас `StubAdapter`). Переключение — `LLM_MODE=api`.
- **Telegram**: реальный бот по `TELEGRAM_BOT_TOKEN` + `setWebhook` (в dev — polling).
- **Apple Reminders (CalDAV)**: нужны `APPLE_*` креды.
- **Парсеры магазинов**: stub-импортеры (реальные API источников — позже).

Демо-данные создаются `npm run seed --workspace core` (идемпотентно).

---

## 📚 Документация

- `docs/ARCHITECTURE.md` — контракт системы
- `docs/ROADMAP.json` — фичи и статусы (37/37 done)
- `docs/PLAN.md` · `docs/HISTORY.md` · `docs/PROGRESS.md` — план/история
- `AGENTS.md` — паттерны и gotchas для разработки

### Session log skill

В репозитории есть локальный Claude Code skill:

```text
.claude/skills/session-log/SKILL.md
```

После clone отдельная установка не нужна: запускай Claude Code из корня репозитория и вызывай
`/session-log` или попроси агента записать сессионный лог. Записи создаются в
`Conversation history/` относительно текущей директории. В лог нельзя вставлять секреты,
токены и значения `.env`.

> Legacy Python/CLI-приложение (markdown/CSV/HTML отчёты, интерактивный CLI) — в ветке `main`.
