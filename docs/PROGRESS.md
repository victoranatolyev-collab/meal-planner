# PROGRESS — append-only journal Ralph Loop

> Этот файл **append-only**. Ralph Loop добавляет сюда заметки между итерациями.
> AI читает PROGRESS в начале каждой итерации, чтобы помнить, что уже узнал.
>
> Формат: каждая запись — timestamp + iteration id + что узнал/сделал/не получилось.
> Новые записи **снизу** (как git log). Не редактируй старые — только добавляй.

---

## Iteration 0 — 2026-05-25 — Старт Ralph Loop

- Подготовлены документы для Ralph: `AGENTS.md` (knowledge base), `docs/PROGRESS.md` (этот файл), `docs/RALPH_PROMPT.md` (главный промпт цикла), `docs/RALPH_GUIDE.md` (инструкции).
- Состояние: 15/37 фичей done. Активная фаза — Phase 2 (Recipes), осталось 2 фичи (scr-search-recipes, scr-edit-rules).
- Последний коммит: `f92d221` (llm-service skeleton + pg-boss + StubAdapter).
- ROADMAP.json служит как PRD. ROADMAP.json features со status≠done — это "stories to pass".

---

<!-- Ralph: добавляй новые записи ниже этой линии -->

## Iteration 1 — 2026-05-28 — scr-search-recipes

- **Сделал:** `scr-search-recipes` (Phase 2, P0). Новый домен `core/src/recipes/` (schemas + llm-client + mapper + search-service) + backend `POST /api/recipes/search`. Пайплайн: searchRecipes() → llm-service (POST /jobs + /wait) → persist Recipe с is_relevant=true, source=LLM, rawIngredients (форма RawIngredient → handoff в scr-normalize-recipe), recipe_tags из mealTags. 16/37 done.
- **Узнал (gotcha):** `POST /jobs/:id/wait` в llm-service отдавал `404 job_not_found` пока воркер не подхватит job — запись в `llm_jobs` (audit) создаётся **лениво** в handleJob, а не при enqueue. Гонка между enqueue и pickup. Фикс: wait трактует `audit==null` как pending (poll до deadline), не 404. Записал в AGENTS.md gotcha #11.
- **Узнал (паттерн):** core МОЖЕТ ходить в llm-service по HTTP (это не импорт). `runLlmJob<S extends ZodTypeAny>` generic возвращает `z.infer<S>` — важно из-за `.default()`: `ZodSchema<T>` коллапсит Input/Output, ломая тип. Записал gotcha #12.
- **Не делал:** AnthropicAdapter + prompts/search-recipes.ts (инъекция профиля/правил в system prompt) — backlog, нужен ANTHROPIC_API_KEY. Stub-first как у парсеров.
- **Проверки:** vitest 56/56, tsc ×4 ws, eslint ×3 ws, next build, smoke end-to-end (docker pg + llm-service stub) = SMOKE_OK.
