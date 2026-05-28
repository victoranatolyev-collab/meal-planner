# RALPH_PROMPT — главный промпт цикла Ralph Loop

> Скопируй блок ниже и подай в `/ralph-loop` (или эквивалентный bash-цикл).
> Используется в КАЖДОЙ итерации цикла без изменений.

---

```
Ты работаешь над rework приложения питания в /Users/victor_mac/Питание/App на ветке rework/nextjs-postgres. Это итеративный Ralph Loop — выполняй ОДНУ задачу за итерацию и сигналь о готовности.

═══ КОНТРАКТ ═══

1) ИСТОЧНИКИ ПРАВДЫ (читай в этой очерёдности в начале КАЖДОЙ итерации):
   - AGENTS.md — паттерны и gotchas проекта
   - docs/ROADMAP.json — список фич (это твой PRD; story = feature, "passes" = status='done')
   - docs/PLAN.md — текущая фаза + активный шаг
   - docs/HISTORY.md — недавние итерации
   - docs/PROGRESS.md — твой append-only journal
   - docs/ARCHITECTURE.md — контракт системы (читай разделы, релевантные текущей задаче)
   - App/CLAUDE.md — общие правила

2) АЛГОРИТМ ОДНОЙ ИТЕРАЦИИ:
   a) Прочитай 4 источника правды + AGENTS.md + PROGRESS.md
   b) Проверь ветку: должна быть rework/nextjs-postgres. Если нет — остановись + AskUserQuestion
   c) Выбери СЛЕДУЮЩУЮ задачу:
      • Активная фаза = первая Phase где есть feature со status≠"done"
      • Внутри фазы — следующая feature по dependencies + приоритету (P0 → P1 → P2)
      • Если есть незакрытые acceptance-критерии в PLAN.md для done-фич — закрой их первыми
   d) Создай docs/.iteration-plan.md (короткий план под эту итерацию, gitignored)
   e) Если возникает структурная неопределённость → AskUserQuestion перед кодом
   f) Реализуй ОДИН логический шаг:
      • Одна фича целиком ИЛИ одна инфраструктурная задача
      • Мельче — лучше. Не растягивай на 10 файлов
      • По ходу отмечай [x] в .iteration-plan.md
   g) Прогоняй mechanical verification:
      • npm run typecheck --workspace <ws> (где менял)
      • npm run test --workspace core (vitest)
      • npm run build --workspace backend (если backend менялся)
      • npm run lint --workspace <ws>
      • prisma migrate diff + apply, если меняешь schema
      • Smoke против docker postgres, если меняешь DB-логику
   h) Если проверки красные — чини в этой же итерации
   i) Обнови документы:
      • docs/HISTORY.md — новая запись СВЕРХУ по формату из файла (Сделано / Столкнулся / Решение / Файлы / Коммит)
      • docs/ROADMAP.json — статус (planned → in_progress → done)
      • docs/PLAN.md — отметь ✅ DONE рядом с feature_id; если фаза завершена — перенеси в "История фаз"
      • docs/PROGRESS.md — append одну запись (timestamp + что нового узнал, особенно gotchas)
      • AGENTS.md — если узнал важный паттерн/правило, ДОБАВЬ в "Gotchas" секцию (не редактируй чужое)
   j) Удали docs/.iteration-plan.md (rm перед коммитом)
   k) Коммит: scope(type): summary; используй inline git -c user.email/name (никогда не правь git config глобально)

3) КРИТЕРИИ ЗАВЕРШЕНИЯ ЦИКЛА:
   Цикл считается ЗАВЕРШЁННЫМ когда:
   • ВСЕ 37 features в ROADMAP.json имеют status="done", ИЛИ
   • Активный пользовательский запрос явно завершён ("остановись", "стоп", "хватит").

   КОГДА завершился → выведи в самой ПОСЛЕДНЕЙ строке ответа точно:
   <promise>RALPH_DONE</promise>

4) ЖЁСТКИЕ ЗАПРЕТЫ:
   • НЕ работать в ветке main (production, заблокирована)
   • НЕ править git config глобально
   • НЕ коммитить .iteration-plan.md
   • НЕ создавать новые .md в docs/ сверх 4 источников + RALPH_*+PROGRESS+ARCHITECTURE (это политика проекта)
   • НЕ импортировать legacy data из meal_planner/ Python-app (clean slate policy)
   • НЕ менять ARCHITECTURE.md без явной нужды + записи в HISTORY с обоснованием
   • НЕ оптимизировать преждевременно
   • НЕ использовать --no-verify, --amend (на pushed commits), --force-push

5) ПРОТОКОЛ ВОПРОСОВ К ПОЛЬЗОВАТЕЛЮ:
   • Используй AskUserQuestion (2-4 опции, "Other" автоматически)
   • Группируй до 4 вопросов в одном вызове
   • Не задавай "можно ли продолжить" — продолжай при отсутствии неопределённости
   • Если задача архитектурная или вкусовая — обязательно спроси

6) КАК ВЫБИРАТЬ "СЛЕДУЮЩУЮ" ЗАДАЧУ В ROADMAP:
   • Сначала: незакрытые acceptance-criteria текущей фазы (см. PLAN.md)
   • Потом: feature со status="planned" в текущей фазе:
     - сортируй по priority (P0 → P1 → P2 → P3)
     - внутри priority — сначала entity (dependencies других features), потом script
   • Если все features текущей фазы done — закрой фазу:
     - перенеси блок в "История фаз" в PLAN.md
     - смени "Активная фаза" в верху PLAN.md
   • Если все 37 features done — сигналь RALPH_DONE

═══ СТАРТ ═══

Прочитай источники правды, выбери следующую задачу, выполни её по алгоритму выше, обнови документы, закоммить. На следующей итерации повтори.

Если задача оказалась слишком большой (>1 hour работы) — разбей и в этой итерации закрой первую подзадачу. Логи в PROGRESS.md.
```

---

## Параметры запуска

При запуске через Anthropic plugin `/ralph-loop`:

```bash
/ralph-loop "$(cat docs/RALPH_PROMPT.md)" \
  --completion-promise "RALPH_DONE" \
  --max-iterations 50
```

При запуске через внешний bash скрипт (см. docs/RALPH_GUIDE.md):
```bash
.ralph/ralph-loop.sh 50
```
