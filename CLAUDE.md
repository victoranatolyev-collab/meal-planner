# Meal Planner — инструкции для Claude

Этот каталог содержит самодостаточное приложение для еженедельного планирования питания с генерацией markdown/CSV/HTML и интерактивным CLI.

## Что я (Claude) могу здесь делать

Когда пользователь работает в этой папке, я могу:

1. **Создавать и править планы** — JSON-файлы в `plans/week_*.json`
2. **Запускать команды** — `python -m meal_planner ...` (см. ниже)
3. **Добавлять новые блюда** — в `data/dishes_library.json`
4. **Добавлять кастомные ингредиенты** — в `data/custom_ingredients.json`
5. **Сверять факт-заказ с планом** — через `order-match`
6. **Валидировать план по правилам** (КБЖУ, бюджет, железо, C1)
7. **Генерировать HTML/markdown отчёты**

## Профиль пользователя

Перед любыми действиями прочитай:
- `data/user_profile.json` — антропометрия, аллергии, тренировки, бюджет
- `data/nutrition_norms.json` — целевые ккал/БЖУ и правила (anemia, lactose, iron-no-coffee)
- `data/menu_rules.md` — текстовые правила (C1, исключения §13a)

**Ключевые факты пользователя:**
- 24 г / 190 см / 86 кг / FFMI 21.2 (атлет)
- Hb 110 — анемия → железо приоритет, печень 1×/нед, кофе/чай не ±1-2ч от железа
- Лактоза лёгкая непереносимость → лактозо-свободное молоко OK
- Тренировки Пн+Чт 12:30-14:00
- Бюджет ≤ 6000₽/неделя (план), soft cap 7000₽
- Цель КБЖУ: 2455 ккал / 161Б / 90Ж / 250У
- НЕ любит: гречку, печень (но 1× ради железа)
- НЕ ест: whey-протеин, чеснок (правило §13a)

## CLI команды

Из папки `app/`:

```bash
# Все артефакты сразу (md + csv + validate + html + report):
python -m meal_planner all plans/week_2026-W21.json

# Отдельно:
python -m meal_planner render <plan>        # → output/weekly_plan.md
python -m meal_planner shopping <plan>      # → output/shopping_list.csv
python -m meal_planner validate <plan>      # → output/validation_report.md
python -m meal_planner report <plan>        # rich-таблицы в терминал
python -m meal_planner order-match <plan>   # сверка факт-заказа
python -m meal_planner html <plan>          # → output/weekly_plan.html
python -m meal_planner create               # интерактивно
python -m meal_planner edit <plan>          # интерактивно
```

## Архитектура

```
app/
├── meal_planner/         # Python-пакет (источник кода)
│   ├── schema.py         # Pydantic-модели (WeekPlan, Dish, Meal, MealItem)
│   ├── catalog.py        # Загрузчик ингредиентов (PLU+local)
│   ├── resolver.py       # Резолв план → ResolvedWeek с КБЖУ
│   ├── render_md.py      # JSON → markdown
│   ├── shopping.py       # JSON → CSV
│   ├── validate.py       # Rule-based валидатор
│   ├── report.py         # Rich-сводка
│   ├── order_match.py    # Diff факт vs план
│   ├── html_viewer.py    # Самодостаточный HTML
│   ├── create.py         # Интерактивное создание
│   ├── edit.py           # Интерактивный редактор
│   ├── config.py         # Пути (override через MEAL_PLANNER_ROOT env)
│   └── __main__.py       # CLI entry point
├── data/
│   ├── ingredients_spb.json     # 5794 PLU Пятёрочки СПб 5590
│   ├── dishes_library.json      # ~30 шаблонов блюд
│   ├── custom_ingredients.json  # Цех 85, ЛЛ, домашние, Маркетплейс
│   ├── user_profile.json        # Профиль (читай для контекста)
│   ├── nutrition_norms.json     # Нормы и правила
│   └── menu_rules.md            # Текстовые правила (контекст)
├── plans/
│   └── week_*.json              # Источники правды (один на неделю)
├── output/                      # Генерируемые артефакты
└── tests/                       # pytest-сьют
```

## Воркфлоу создания новой недели

Если пользователь говорит «сделай новую неделю» или «план на следующую неделю»:

1. Прочитай предыдущую неделю: `plans/week_LAST.json`
2. Создай новую: `cp plans/week_LAST.json plans/week_NEW.json`
3. Обнови в новой:
   - `week_id`, `start_date`, `end_date`
   - `stock_at_home[]` — учти остатки от прошлой недели (Milky Way -3 шт уже использовано, и т.д.)
   - Убери `actual_orders[]` (старый заказ)
   - Если нужно — поменяй блюда в `schedule[].meals[].items[].dish_id`
4. Прогони: `python -m meal_planner all plans/week_NEW.json`
5. Покажи валидацию-отчёт пользователю
6. Если есть ошибки/warnings — обсуди с пользователем, поправь, перегенерируй

## Воркфлоу после факт-заказа

Если пользователь прислал фактический заказ Пятёрочки:

1. Прочитай скриншоты заказа или открытую страницу
2. Добавь в `plans/week_*.json` секцию `actual_orders[]` с массивом `items`
3. Запусти: `python -m meal_planner order-match plans/week_*.json`
4. Покажи различия: missing / extra / qty_diff / price_diff
5. Если есть критичные расхождения (отсутствует ингредиент Main A) — предложи правки плана

## Правила, которые ВСЕГДА проверяй

1. **Iron rule (Вс):** в приёмах с тегом `iron_meal` — НЕТ молочки, НЕТ кофе/чая ±1-2ч
2. **C1:** сладкий завтрак (тег `sweet_breakfast`) — БЕЗ сладкого хвоста (если не указан `c1_exclusion`)
3. **Протеин ≥ 1.4 г/кг** = 120г/день минимум (целевые 161г = 1.87 г/кг)
4. **Курица ≥ 4 дней/нед** (любимое + источник белка)
5. **Печень 1×/нед** (для железа)
6. **ЛЛ десерты ≤ 3×/нед** (бюджетный фактор + сахар)
7. **Бюджет ≤ 6000₽** (target), 7000₽ soft cap

## Запрещённые продукты (§13a)

- ❌ Чеснок
- ❌ Гречка
- ❌ Майонез
- ❌ Whey-протеин
- ❌ Алкоголь (только 1 раз/нед в выходные с учётом ккал)

## Полезные ссылки на код

- `data/dishes_library.json` — все доступные блюда (используй `dish_id` оттуда)
- `meal_planner/schema.py` — структура JSON-плана
- `meal_planner/validate.py` — список правил валидатора (полный)
- `meal_planner/__main__.py` — список CLI команд

## Если что-то непонятно

Спроси пользователя. НЕ выдумывай PLU/КБЖУ. Если ингредиента нет в каталоге — добавь в `data/custom_ingredients.json` с реалистичными значениями ИЛИ запроси у пользователя точные данные с упаковки.
