# 🍽 Meal Planner

Самодостаточное приложение для еженедельного планирования питания с:
- генерацией markdown/CSV/HTML отчётов
- проверкой правил (КБЖУ, бюджет, железо при анемии, C1-исключение для сладких завтраков)
- интерактивным CLI создания и редактирования
- сверкой фактического заказа с планом

## 📁 Структура

```
app/
├── README.md                # этот файл
├── CLAUDE.md                # инструкции для Claude-агента
├── requirements.txt         # Python зависимости (pip)
├── pyproject.toml           # установка как пакет
├── setup.sh                 # автосетап
├── Makefile                 # удобные команды
│
├── meal_planner/            # 🐍 Python пакет (источник кода)
│   ├── schema.py            # Pydantic-модели
│   ├── catalog.py           # загрузчик ингредиентов
│   ├── resolver.py          # резолв план → ResolvedWeek
│   ├── render_md.py         # markdown-рендер
│   ├── shopping.py          # генератор shopping list
│   ├── validate.py          # rule-based валидатор
│   ├── report.py            # rich-сводка
│   ├── order_match.py       # diff факт-заказа vs план
│   ├── html_viewer.py       # самодостаточный HTML
│   ├── create.py            # интерактивное создание
│   ├── edit.py              # интерактивный редактор
│   ├── config.py            # пути (env-overrideable)
│   └── __main__.py          # CLI entry point
│
├── data/                    # 📚 Источники данных
│   ├── ingredients_spb.json     # 5794 PLU Пятёрочки СПб
│   ├── dishes_library.json      # шаблоны блюд (Main A/B/C, шаурма, ...)
│   ├── custom_ingredients.json  # Цех 85, ЛЛ, дом, Маркетплейс
│   ├── user_profile.json        # профиль пользователя
│   ├── nutrition_norms.json     # нормы и правила
│   └── menu_rules.md            # текстовые правила
│
├── plans/                   # 📅 Источники правды (один JSON на неделю)
│   └── week_2026-W21.json
│
├── output/                  # 📤 Генерируемые артефакты (gitignored)
│   ├── weekly_plan.md
│   ├── weekly_plan.html
│   ├── shopping_list.csv
│   └── validation_report.md
│
├── tests/                   # 🧪 pytest сьют (37 тестов)
│
└── .claude/
    └── skills/
        └── meal-planner/
            ├── SKILL.md
            └── prompts/
                ├── create-new-week.md
                ├── update-from-order.md
                └── validate-current.md
```

## 🚀 Установка на новой машине

Требования: **Python 3.10+**, **macOS / Linux** (Windows тоже должен работать но не тестировался).

```bash
# 1. Клонировать или скопировать папку app/
cd app/

# 2. Запустить setup (создаст .venv, установит deps, прогонит тесты)
./setup.sh
```

Или вручную:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[test]"
pytest tests/ -q
```

## 🛠 Использование

После `source .venv/bin/activate`:

```bash
# Полный пайплайн (md + csv + html + validate + report):
python -m meal_planner all plans/week_2026-W21.json
# Или через Makefile:
make all PLAN=plans/week_2026-W21.json

# Отдельные команды:
python -m meal_planner render plans/week_2026-W21.json
python -m meal_planner shopping plans/week_2026-W21.json
python -m meal_planner validate plans/week_2026-W21.json
python -m meal_planner report plans/week_2026-W21.json
python -m meal_planner html plans/week_2026-W21.json
python -m meal_planner order-match plans/week_2026-W21.json

# Интерактивно создать новый план:
python -m meal_planner create --week-id 2026-W22

# Интерактивно править существующий:
python -m meal_planner edit plans/week_2026-W21.json
```

Короткие алиасы после установки: `mp ...` или `meal-planner ...`

## 📐 Концепты

### Источник правды: один JSON-файл

`plans/week_*.json` хранит ВСЁ для одной недели: цели КБЖУ, бюджет, домашние запасы, расписание приёмов, фактические заказы.

Из него генерируется markdown / CSV / HTML.

### Ссылки на ингредиенты

В рецептах используются `ref` строки:
- `"plu:3191298"` → товар из `data/ingredients_spb.json` (Пятёрочка СПб)
- `"local:mw_mini"` → товар из `data/custom_ingredients.json`

Резолвер вычисляет имя, КБЖУ, цену через эти каталоги.

### Блюда (`data/dishes_library.json`)

Шаблоны рецептов: `main_a`, `main_b`, `main_c`, `spring_shawarma`, `shawarma_bowl_sat`, и т.д.

Каждое блюдо — массив ингредиентов с `qty_g` и метаданными (`fresh_addon`, `note`).

В плане недели ссылаешься через `dish_id` + опционально `portion: 1.5` (множитель).

### Теги для правил

На приёмы (meals) ставятся теги, которые валидатор использует:
- `pre_workout`, `post_workout` — тренировочные приёмы
- `iron_meal`, `no_dairy` — Вс приёмы с печенью
- `iron_window_start`, `iron_window_end` — маркеры окна без кофе
- `sweet_breakfast` — для C1-правила
- `c1_exclusion` — намеренное нарушение C1
- `frozen_thaw` — нужна разморозка

### Каталог Пятёрочки

`data/ingredients_spb.json` = 5794 PLU из магазина СПб 5590 (выгрузка от 14 мая 2026). Имя, KBJU, цена, вес упаковки, штрих-категории.

Если нужного товара нет — добавь в `data/custom_ingredients.json`.

## 🧪 Тесты

```bash
make test
# или: pytest tests/ -v
```

37 тестов покрывают:
- Pydantic-валидацию схем
- Catalog (PLU/local resolve, KBJU, поиск)
- Resolver (день КБЖУ, cumulative)
- Shopping aggregation
- Валидатор (iron rule, протеин, курица 4 дня)
- Order matcher

## ⚙ Конфигурация путей

По умолчанию пути относительно `app/` (там где `meal_planner/`).

Можно переопределить через env:
```bash
export MEAL_PLANNER_ROOT=/path/to/my/data
python -m meal_planner report plans/week_2026-W21.json
```

Это удобно если данные/планы хранятся отдельно от кода.

Проверить разрешённые пути:
```bash
make debug-paths
```

## 🔄 Воркфлоу

### Создание новой недели
1. `cp plans/week_2026-W21.json plans/week_2026-W22.json`
2. Открыть редактором, обновить `week_id`, даты, `stock_at_home`, расписание
3. `make all PLAN=plans/week_2026-W22.json`
4. Открыть `output/weekly_plan.html` в браузере

### После доставки заказа
1. Открыть приложение 5ka.ru → заказ → переписать товары/веса/цены
2. Добавить в `actual_orders[]` в `plans/week_*.json`
3. `make order-match PLAN=plans/week_*.json`
4. Решить как использовать запасы/убрать недостающие позиции

## 📖 Дополнительно

- **`CLAUDE.md`** — инструкции для AI-агента, который работает с этим репо
- **`.claude/skills/meal-planner/`** — Claude Code скилл с готовыми воркфлоу
- **`data/menu_rules.md`** — все текстовые правила питания
- **`data/user_profile.json`** — антропометрия и личные ограничения

## 🚧 Roadmap

- [ ] Парсинг скриншотов заказа Пятёрочки (через OCR/Vision) → автозаполнение `actual_orders[]`
- [ ] Stock tracker (учёт остатков после каждой недели → `stock_at_home` авто)
- [ ] Diff между неделями (что изменилось)
- [ ] История цен (тренды)
- [ ] Substitution engine (если перец нет → жёлтый)
- [ ] Iron intake tracker (накопительное железо)

## 📝 Лицензия

MIT
