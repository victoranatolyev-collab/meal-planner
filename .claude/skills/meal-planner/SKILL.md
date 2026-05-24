---
name: meal-planner
description: Plan, validate, and edit weekly meal plans with KBJU/budget/iron-rule checks. Use when user asks to create a meal plan for a week, edit existing plan, check KBJU/budget against targets, validate iron-meal rules, generate shopping list, render HTML/markdown views, or compare actual purchase to plan.
---

# Meal Planner skill

Skill for working with the `app/` meal planning system in this repo.

## When to use

Trigger this skill when the user mentions:
- «План питания», «недельный план», «meal plan»
- «КБЖУ» / «калории» / «белки/жиры/углеводы» / «макросы»
- «Список покупок», «корзина», «закупка»
- «Пятёрочка», «Цех 85», «Люди Любят», «ЛЛ»
- «Заказ номер», скриншоты заказа доставки
- «Бюджет», «6000₽»
- «Тренировка Пн/Чт», «pre-workout», «post-workout»
- «Железо», «анемия», «Hb 110», «печень»
- Имена блюд: Main A/B/C, спринг-шаурма, шаурма-боул, кесадилья

## Что в этом репо

```
app/
├── CLAUDE.md                  # детальные инструкции
├── data/                      # каталоги (ингредиенты + правила)
├── plans/week_*.json          # источник правды (один на неделю)
├── meal_planner/              # Python пакет
├── output/                    # генерируемые артефакты
└── tests/                     # pytest сьют
```

## Базовые операции

### Посмотреть текущий план

```bash
python -m meal_planner report plans/week_2026-W21.json
```

### Полная регенерация артефактов

```bash
python -m meal_planner all plans/week_2026-W21.json
```

Создаёт:
- `output/weekly_plan.md` — markdown с расписанием/рецептами
- `output/weekly_plan.html` — интерактивный HTML с фильтрами
- `output/shopping_list.csv` — список покупок по магазинам
- `output/validation_report.md` — проверка правил

### Создать новую неделю

Опция A (быстро): копируй и правь
```bash
cp plans/week_2026-W21.json plans/week_2026-W22.json
# Поправь в редакторе: week_id, даты, schedule, stock_at_home
python -m meal_planner all plans/week_2026-W22.json
```

Опция B (интерактивно):
```bash
python -m meal_planner create --week-id 2026-W22
```

### После доставки — сверить факт vs план

1. Добавь `actual_orders[]` в `plans/week_*.json`:
```json
"actual_orders": [{
  "shop": "Пятёрочка",
  "order_id": "1234567890",
  "paid_rub": 5062.01,
  "items": [
    {"plu": "3191298", "name": "...", "qty": 1.6, "unit": "кг", "price_rub_total": 384}
  ]
}]
```
2. Запусти `order-match`:
```bash
python -m meal_planner order-match plans/week_2026-W21.json
```

## Перед действиями ВСЕГДА

1. Прочитай `app/CLAUDE.md` (полные инструкции)
2. Прочитай `app/data/user_profile.json` (Hb 110, лактоза, ½ кг бюджет ограничения)
3. Прочитай `app/data/nutrition_norms.json` (целевые 2455 ккал / 161 / 90 / 250)
4. Прочитай `app/data/menu_rules.md` (C1, исключения §13a)

## Правила-табу

❌ НЕ предлагай: чеснок, гречку, майонез, whey-протеин, алкоголь >1×/нед

❌ НЕ нарушай iron rule на Вс: молочка/кофе/чай в обед+ужин с печенью

❌ НЕ ставь сладкий хвост к сладкому завтраку (Цех 85 — TS-09, TS-13, TS-14, TS-03)

## Связанные prompts

В `prompts/` есть подготовленные сценарии:
- `create-new-week.md` — создать план на след. неделю с учётом остатков
- `update-from-order.md` — внести факт-заказ и сверить
- `validate-current.md` — проверить текущий план на правила
