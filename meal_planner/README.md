# meal_planner — недельный планировщик питания

Скрипты-генераторы для управления недельным планом питания с источником правды в JSON.

## 🏗 Архитектура

```
Питание/
├── data/                              # Каталоги
│   ├── ingredients_spb.json           # 5794 PLU Пятёрочка СПб 5590 (KBJU + цены)
│   ├── custom_ingredients.json        # Дом / Цех 85 / ЛЛ / Маркетплейс
│   └── dishes_library.json            # Библиотека рецептов (Main A, шаурма, ...)
├── plans/
│   └── week_2026-W21.json             # ИСТОЧНИК ПРАВДЫ для недели
├── scripts/meal_planner/              # Python-пакет
│   ├── schema.py                      # Pydantic-модели
│   ├── catalog.py                     # Загрузка ингредиентов
│   ├── resolver.py                    # Резолв план + библиотека → ингредиенты
│   ├── render_md.py                   # JSON → markdown
│   ├── shopping.py                    # JSON → shopping_list.csv
│   ├── validate.py                    # Правила: KBJU/бюджет/железо/C1
│   ├── report.py                      # Rich-сводка в терминал
│   ├── order_match.py                 # Сверка факт-заказа с планом
│   ├── html_viewer.py                 # Самодостаточный HTML-вьюер
│   ├── create.py                      # Интерактивное создание плана
│   ├── edit.py                        # Интерактивный редактор
│   └── __main__.py                    # CLI entry point
├── tests/                             # pytest-сьют (37 тестов)
└── output/                            # Сгенерированные артефакты
    ├── weekly_plan.md
    ├── shopping_list.csv
    ├── validation_report.md
    └── weekly_plan.html
```

## 🚀 Быстрый старт

### Зависимости
```bash
.venv/bin/pip install pydantic click jinja2 pytest rich questionary
```

### Команды CLI

```bash
# Из корня проекта:
PYTHONPATH=scripts .venv/bin/python -m meal_planner --help

# Сгенерировать ВСЁ из плана (md + csv + validation + html + report):
PYTHONPATH=scripts .venv/bin/python -m meal_planner all plans/week_2026-W21.json

# Отдельные команды:
PYTHONPATH=scripts .venv/bin/python -m meal_planner render plans/week_2026-W21.json
PYTHONPATH=scripts .venv/bin/python -m meal_planner shopping plans/week_2026-W21.json
PYTHONPATH=scripts .venv/bin/python -m meal_planner validate plans/week_2026-W21.json
PYTHONPATH=scripts .venv/bin/python -m meal_planner report plans/week_2026-W21.json
PYTHONPATH=scripts .venv/bin/python -m meal_planner order-match plans/week_2026-W21.json
PYTHONPATH=scripts .venv/bin/python -m meal_planner html plans/week_2026-W21.json

# Создать новый план интерактивно:
PYTHONPATH=scripts .venv/bin/python -m meal_planner create

# Редактировать существующий:
PYTHONPATH=scripts .venv/bin/python -m meal_planner edit plans/week_2026-W21.json
```

### Запуск тестов

```bash
.venv/bin/python -m pytest tests/ -v
```

## 📋 Формат плана

Минимальный пример `plans/week_2026-W21.json`:

```json
{
  "schema_version": "weekly_plan_v1",
  "week_id": "2026-W21",
  "start_date": "2026-05-18",
  "end_date": "2026-05-24",
  "nutrition_targets": {
    "kcal_per_day": 2455,
    "protein_g_per_day": 161,
    "fat_g_per_day": 90,
    "carbs_g_per_day": 250
  },
  "budget": {
    "target_rub_per_week": 6000,
    "soft_cap_rub": 7000
  },
  "stock_at_home": [
    {"ref": "local:mw_mini", "qty_units": 3}
  ],
  "schedule": [
    {
      "day": "Пн",
      "day_type": "training",
      "date": "2026-05-18",
      "meals": [
        {
          "num": 1, "name": "Завтрак", "time": "08:30",
          "items": [
            {"dish_id": "main_a", "portion": 1.0},
            {"dish_id": "milky_way_mini", "from_stock": true, "tail": true}
          ],
          "tags": ["pre_workout"]
        }
      ]
    }
  ]
}
```

## 🧠 Концепты

### Ингредиент-ссылки (refs)

- `plu:3191298` — товар из `data/ingredients_spb.json` (5794 PLU Пятёрочки)
- `local:mw_mini` — товар из `data/custom_ingredients.json` (дом/Цех 85/ЛЛ/прочее)

Каталог разрешает ref → нормализованный объект с `kcal_per_100g`, `protein/fat/carbs_per_100g`, `price_rub`, `weight_g`, `shop`.

### Блюда (dishes)

`data/dishes_library.json` хранит шаблоны (Main A, Main B, спринг-шаурма, ...) с массивом `ingredients`. Каждый ингредиент = `{"ref": "...", "qty_g": 100, "fresh_addon": false, "note": "..."}`.

`fresh_addon: true` означает, что ингредиент добавляется в день употребления (свежий, не в batch-cook). Используется для риса/огурца/перца в Main A.

### Приёмы (meals)

Каждый приём — массив `items`. Item ссылается на `dish_id` (с `portion`) или прямую `ingredient_ref` с весом.

Флаги:
- `tail: true` — это сладкий хвост (для C1-правила)
- `from_stock: true` — не покупать, есть дома

### Теги

На приёме можно ставить теги для валидатора:
- `pre_workout` / `post_workout`
- `iron_meal` + `no_dairy` — Вс приёмы с печенью
- `iron_window_start` / `iron_window_end` — маркеры
- `sweet_breakfast` — для C1-правила
- `c1_exclusion` — если намеренно нарушаем C1

## 🛠 Скрипты

### `render` → markdown

Генерирует читабельный `weekly_plan.md` с таблицами по дням, рецептами, сводкой КБЖУ, фактическими заказами.

### `shopping` → CSV

Агрегирует все ингредиенты из всех приёмов недели, исключает товары из `stock_at_home`, считает упаковки/кг, цены, группирует по магазинам.

Колонки: `shop, plu, code, name, category, qty_total_g, qty_packages, qty_buy_kg, weight_g_per_package, price_per_unit, price_total_rub, from_stock, note, ref`.

### `validate` → markdown report

Проверки:
- 🔴 **iron_meal_no_dairy** — молочка в Вс железных приёмах
- 🟡 **kbju_daily_kcal** — ±10% (warning) / ±20% (error) от цели
- 🟡 **kbju_daily_protein** — белок <70% цели на день
- 🟡 **kbju_weekly_protein_avg** — средний белок <80% цели
- 🟡 **iron_rule_no_coffee** — кофе/чай ±1-2ч от железа
- 🟡 **c1_sweet_breakfast** — сладкий хвост у сладкого завтрака
- 🟡 **protein_chicken_4days** — курица <4 дней
- 🔴 **protein_liver_weekly** — печень 0 раз
- 🟡 **protein_fish_weekly** — рыба 0 раз
- 🟡 **ll_count_3max** — ЛЛ-десертов >3
- 🟡 **budget** — превышение бюджета

### `order-match` → diff

Сравнивает планируемый shopping list с `actual_orders` в плане. Находит:
- ❌ missing — план есть, факта нет
- ➕ extra — факт есть, плана нет
- ⚖️ qty_diff — расхождение по весу >15%
- 💰 price_diff — расхождение по цене >20%

Полезно после факт-заказа, чтобы найти запасы и пересчёт бюджета.

### `html` → веб-интерфейс

Один self-contained HTML с:
- КБЖУ-сводка + bar-chart по дням
- Расписание по дням с КБЖУ-deltas и хвостами
- Shopping list с фильтрами по магазину
- Сворачиваемые блоки с фактическими заказами
- Валидация-результат

Открывается в любом браузере, не требует сервера.

### `report` — rich-таблицы в терминал

Цветные таблицы (КБЖУ по дням с Δ%, бюджет, фактические заказы, железо-протокол Вс).

### `create` — интерактивное создание

Запрашивает week_id, КБЖУ-цели, бюджет, затем для каждого дня предлагает шаблон (training/office/home/sunday_batch/empty). Сохраняет в `plans/week_*.json`.

### `edit` — интерактивный редактор

Атомарные операции:
- Заменить блюдо в приёме
- Изменить порцию
- Добавить хвост (со списком sweet_dishes)
- Удалить позицию
- Показать сводку

## 🧪 Тесты

```
tests/
├── conftest.py              # fixtures (plan_path, resolver, resolved_week)
├── test_schema.py           # Pydantic validation
├── test_catalog.py          # PLU/local resolution, KBJU calc, search
├── test_resolver.py         # day kbju, cumulative, tags
├── test_shopping.py         # aggregation, shop summary
├── test_validate.py         # iron rule, protein deficit, chicken days
└── test_order_match.py      # match/missing/extra/diff detection
```

Всего 37 тестов. Запуск: `.venv/bin/python -m pytest tests/ -v`.

## 🔄 Воркфлоу типичного использования

### Создание новой недели
```bash
# 1. Интерактивно создать каркас
PYTHONPATH=scripts .venv/bin/python -m meal_planner create --week-id 2026-W22

# 2. Прогнать ВСЁ (md + csv + html + validate)
PYTHONPATH=scripts .venv/bin/python -m meal_planner all plans/week_2026-W22.json

# 3. Открыть html в браузере
open output/weekly_plan.html

# 4. Если нужно — поправить
PYTHONPATH=scripts .venv/bin/python -m meal_planner edit plans/week_2026-W22.json

# 5. Перегенерировать
PYTHONPATH=scripts .venv/bin/python -m meal_planner all plans/week_2026-W22.json
```

### После заказа
```bash
# 1. Внести фактический заказ в plans/week_*.json в секцию actual_orders
#    (пока вручную; в будущем может быть скрипт парсинга PDF/скриншота)

# 2. Сверить план vs факт
PYTHONPATH=scripts .venv/bin/python -m meal_planner order-match plans/week_2026-W21.json
```

## 📐 Расширение

### Добавить новое блюдо
Дописать в `data/dishes_library.json` секцию `dishes`:
```json
"my_new_dish": {
  "id": "my_new_dish",
  "name": "Моё новое блюдо",
  "ingredients": [
    {"ref": "plu:1234567", "qty_g": 100},
    {"ref": "local:mw_mini", "qty_g": 26}
  ],
  "method": "Описание готовки",
  "tags": ["custom"]
}
```

### Добавить новый ингредиент (вне Пятёрочки)
Дописать в `data/custom_ingredients.json`:
```json
"my_ingredient": {
  "id": "my_ingredient",
  "name": "Моя позиция",
  "shop": "Магазин",
  "weight_g": 100,
  "kcal_per_100g": 200,
  "protein_per_100g": 10,
  ...
  "price_rub": 50,
  "unit": "шт"
}
```

### Добавить новое правило валидации
В `validate.py` добавить метод `_validate_my_rule(self, resolved) -> list[ValidationIssue]` и вызвать его из `validate()`.

## 🚧 Roadmap

- [ ] Парсинг скриншотов заказа 5ka → automatic `actual_orders`
- [ ] Stock tracker (учёт остатков после каждой недели)
- [ ] Diff между неделями
- [ ] История цен (трендинг)
- [ ] Substitution engine (если перец нет → жёлтый)
- [ ] iron_intake_tracker (накопительное железо за нед)
