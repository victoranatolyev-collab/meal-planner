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
