# Meal Planner — Rework (Next.js backend + Vite/React frontend)

> Эта ветка (`rework/nextjs-postgres`) — полный рерайт приложения.
> Старая Python-версия — в ветке `main`, **не трогать**.

---

## 🚨 ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА ДЛЯ AI-АГЕНТА

### 1. Перед началом работы ВСЕГДА читай 4 документа:
- **`docs/ARCHITECTURE.md`** — контракт системы. Все решения по коду должны соответствовать ему.
- **`docs/ROADMAP.json`** — какие фичи нужны, их статусы, описания, зависимости.
- **`docs/PLAN.md`** — текущий план: какие фазы, на каком шаге сейчас.
- **`docs/HISTORY.md`** — что уже сделано, какие решения приняты ранее.

### 2. После КАЖДОЙ значимой итерации обнови:
- **`docs/HISTORY.md`** — добавь запись (datestamp + 2-5 строк по структуре: что сделал / с чем столкнулся / какое решение / файлы / коммит). Кратко.
- **`docs/ROADMAP.json`** — обнови `status` фич (`planned` → `in_progress` → `done`).
- **`docs/PLAN.md`** — отметь прогресс по шагам (галочки в `[ ]` → `[x]`).

### 3. `docs/ARCHITECTURE.md` — менять ТОЛЬКО при крайней необходимости:
- Это контракт. Несовместимые правки = переписывание кода.
- При изменении: обязательно фиксируй в `HISTORY.md` с обоснованием.

### 4. Ветка `main` — заблокирована.
Там работающее Python-приложение в продакшене. **Не трогать**. Можно читать для понимания старой логики.

### 5. Reference-данные пользователя
До первого запуска БД для контекста смотри (из `main`):
- `App/data/user_profile.json` — антропометрия, аллергии, тренировки
- `App/data/nutrition_norms.json` — нормы и правила
- `App/data/menu_rules.md` — текстовые правила

После первого запуска источник правды — БД (Postgres).

---

## Стек (сводка, детали в `docs/ARCHITECTURE.md`)

| Слой | Технология |
|---|---|
| **Backend** | Next.js (App Router) — только REST API + worker |
| **Frontend** | React + Vite + TypeScript + **SCSS** (отдельное SPA) |
| **DB** | PostgreSQL + Prisma |
| **LLM** | Anthropic Claude API (`@anthropic-ai/sdk`) |
| **Telegram** | grammY (LLM-агент с tool-use доступом) |
| **Notifications** | Apple Reminders via CalDAV |
| **Deploy** | Self-host VPS + Docker (compose: backend / frontend / worker / postgres) |
| **Testing** | Vitest (unit) + Playwright (e2e) |

См. `docs/ARCHITECTURE.md` для полной картины и деталей.

---

## Концепция модулей (логические группы)

1. **Поиск** — парсинг данных из источников + поиск рецептов
2. **Валидация** — проверка рецептов и правил
3. **Расчёт** — нормы, план недели, остатки, корзина, заказ
4. **Сопровождение** — дневник, коррекции плана, Apple Reminders, Telegram-агент
