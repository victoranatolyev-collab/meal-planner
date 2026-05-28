# RALPH_GUIDE — как запустить Ralph Loop на этом проекте

> Этот документ — инструкция для **пользователя** (Victor), не для AI-агента.
> AI-агент работает по `docs/RALPH_PROMPT.md`.

## Что такое Ralph Loop (1 минута)

Ralph Loop — методика автономной разработки: AI-агент Claude Code прогоняет одну и ту же prompt-задачу в цикле `while true`. На каждой итерации видит свои предыдущие файлы и git history, поэтому может продолжать с того места, где остановился. Цикл сам останавливается когда AI выводит фразу-сигнал (`<promise>RALPH_DONE</promise>`) или исчерпывает лимит итераций.

Применительно к нам: каждая итерация Ralph = одна фича из ROADMAP.json или одна подзадача. Ralph будет крутиться пока все 37 features не получат status="done".

**Документация:**
- Anthropic plugin: https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md
- Оригинальная статья: https://ghuntley.com/ralph/

---

## Что уже подготовлено

| Файл | Что внутри |
|---|---|
| `AGENTS.md` | Паттерны/gotchas проекта (читает AI каждую итерацию) |
| `docs/RALPH_PROMPT.md` | Главный промпт цикла. Подается в Ralph без изменений каждую итерацию |
| `docs/PROGRESS.md` | Append-only journal научений (Ralph добавляет, не редактирует) |
| `docs/ROADMAP.json` | **PRD цикла.** Stories = features со status≠"done" (22 шт сейчас) |
| `docs/PLAN.md` | Фазы 0–6 |
| `docs/ARCHITECTURE.md` | Контракт системы |
| `docs/HISTORY.md` | История итераций |

---

## Способ запуска

Есть 2 варианта. Anthropic plugin проще (одна сессия Claude Code). Внешний bash — даёт fresh-context на каждой итерации (изоляция, но больше токенов).

### Способ 1: Anthropic plugin `ralph-wiggum` (рекомендую для начала)

**Шаг 1 — установить плагин в Claude Code:**

В Claude Code сессии:
```
/plugin install ralph-wiggum
```

> Если команды нет — плагин может быть под другим именем; проверь `https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum` для актуальных инструкций установки.

**Шаг 2 — запуск:**

В Claude Code сессии:
```
/ralph-loop "$(cat docs/RALPH_PROMPT.md)" --completion-promise "RALPH_DONE" --max-iterations 50
```

**Шаг 3 — мониторинг:**

Плагин показывает прогресс в текущей сессии. Можно прервать через `/cancel-ralph`.

**Шаг 4 — после остановки:**

Проверь:
- `git log --oneline -30` — какие коммиты сделаны
- `cat docs/HISTORY.md` — что Ralph пишет про итерации
- `cat docs/PROGRESS.md` — что Ralph узнал по дороге
- `cat AGENTS.md` — обновился ли knowledge base
- `python3 -c "import json; d=json.load(open('docs/ROADMAP.json')); print(sum(1 for f in d['features'] if f['status']=='done'), '/37 done')"` — сколько фич закрыто

---

### Способ 2: внешний bash скрипт (fresh context каждую итерацию)

Создай `.ralph/ralph-loop.sh`:

```bash
#!/bin/bash
# Внешний цикл: spawning fresh Claude Code subprocess на каждой итерации.
# Использование: ./ralph-loop.sh <max_iterations>

MAX=${1:-30}
PROMPT_FILE="docs/RALPH_PROMPT.md"

for i in $(seq 1 $MAX); do
  echo "=== Iteration $i / $MAX ==="
  OUTPUT=$(claude --no-confirm "$(cat $PROMPT_FILE)" 2>&1)
  echo "$OUTPUT"
  if echo "$OUTPUT" | grep -q "<promise>RALPH_DONE</promise>"; then
    echo "Ralph Loop COMPLETE after $i iterations"
    exit 0
  fi
  echo "--- iteration $i finished, continuing ---"
  sleep 5
done
echo "Ralph reached max iterations ($MAX) without RALPH_DONE — stopped"
```

Запуск:
```bash
chmod +x .ralph/ralph-loop.sh
.ralph/ralph-loop.sh 50
```

**Внимание:** этот вариант создаёт новую сессию Claude Code на каждый цикл — расход токенов выше. Но контекст «чище» (нет накопления мусора в одной длинной сессии).

---

## Перед первым запуском (чек-лист)

- [ ] Ветка `rework/nextjs-postgres` (не main!). Проверь: `git branch --show-current`
- [ ] Все локальные изменения закоммичены. `git status` чистый
- [ ] `docs/ROADMAP.json` валиден: `python3 -c "import json; json.load(open('docs/ROADMAP.json'))"`
- [ ] postgres docker не запущен (Ralph сам поднимет когда нужно): `docker compose ps` пуст
- [ ] `.iteration-plan.md` отсутствует (если есть — удали)
- [ ] Если нужны live LLM-вызовы (для scr-search-recipes): `ANTHROPIC_API_KEY` в `.env`

---

## Как остановить цикл

### Anthropic plugin
В Claude Code сессии: `/cancel-ralph`. Или Ctrl+C.

### Bash скрипт
Ctrl+C в терминале.

После остановки Ralph должен оставить:
- Свежие коммиты в git
- Запись в `docs/HISTORY.md`
- Запись в `docs/PROGRESS.md`
- Обновлённые статусы в `docs/ROADMAP.json`

Если что-то незакоммичено — Ralph остановился в середине итерации. Проверь `git status`, реши: закоммитить вручную или сбросить.

---

## Что делать, если Ralph «застрял»

Симптомы: одна и та же фича несколько итераций подряд, обновления PROGRESS нет, тесты красные.

1. Прерви цикл (`/cancel-ralph` или Ctrl+C)
2. Прочитай последние 5 записей `docs/HISTORY.md` — что Ralph пытался
3. Прочитай `docs/PROGRESS.md` — что он узнал
4. Если нужно вмешательство:
   - Поправь руками то, на чём он застрял
   - Или измени `docs/RALPH_PROMPT.md` чтобы дать подсказку
   - Закоммить вручную
5. Перезапусти цикл

## Что делать, если изменилась архитектура

Если ARCHITECTURE.md обновляется — Ralph узнает на следующей итерации (он перечитывает в каждой). Можно прервать текущую итерацию и запустить заново со свежим состоянием.

## Идемпотентность

Каждая итерация Ralph — атомарный коммит. Если ралф остановится в середине — последнее cohesive состояние = последний коммит. Можно безопасно перезапустить.

---

## FAQ

**Q: Сколько итераций Ralph пройдёт чтобы закрыть все 37 фич?**
A: Точно неизвестно. У нас осталось 22 фичи. Если каждая = 1-3 итерации (с учётом дробления больших фич) — ориентир 40-80 итераций. Поставь `--max-iterations 50` для безопасности, при необходимости перезапусти.

**Q: Можно ли запускать без надзора (AFK режим)?**
A: Технически да. Но лучше в первые 5-10 итераций понаблюдай. Если Ralph правильно выбирает задачи и обновляет docs — отпускай.

**Q: Что Ralph НЕ может?**
A: Он не сделает за тебя то, что требует AskUserQuestion (выбор библиотеки, дизайн UI, внешние credentials). Когда спросит — отвечай.

**Q: Стоимость API?**
A: Anthropic plugin использует твою аутентифицированную сессию Claude Code (твой план). Bash скрипт — `claude` CLI, тоже твоя сессия. Внешние API ключи не нужны если LLM_MODE=stub для llm-service.
