"""
Interactive plan creator.

Workflow:
1. Ask for week_id, start_date, targets, budget
2. Generate skeleton with 7 days (Пн-Вс)
3. For each day, pick a template (training/office/home) — pre-fills typical meals
4. Display running KBJU and allow tweaks via dish picker
5. Save to plans/week_*.json

Day templates use dish_ids from data/dishes_library.json.
"""

from __future__ import annotations
import json
import datetime
from pathlib import Path
from typing import Optional

import questionary
from rich.console import Console

from .schema import (
    WeekPlan, NutritionTargets, Budget, StockItem, Day, Meal, MealItem
)
from .resolver import load_dishes_library
from .config import PLANS_DIR


console = Console()

DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


# Pre-built day templates
TRAINING_DAY_TEMPLATE = [
    {"num": 1, "name": "Завтрак 1", "time": "08:30", "items": [
        {"dish_id": "spring_shawarma"},
        {"dish_id": "milky_way_mini", "from_stock": True, "tail": True},
    ], "tags": ["frozen_thaw"]},
    {"num": 2, "name": "Завтрак 2", "time": "11:30", "items": [
        {"dish_id": "coffee_with_milk"},
        {"dish_id": "snickers_50"},
    ], "tags": ["pre_workout"]},
    {"num": 3, "name": "Тренировка", "time": "12:30", "items": [
        {"dish_id": "training_90min"},
    ]},
    {"num": 4, "name": "Обед", "time": "14:00", "items": [
        {"dish_id": "main_a"},
        {"dish_id": "chocolate_dark_20g", "tail": True},
    ], "tags": ["post_workout"]},
    {"num": 5, "name": "Ужин", "time": "18:30", "items": [
        {"dish_id": "main_a"},
        {"dish_id": "chocolate_dark_20g", "tail": True},
    ]},
    {"num": 6, "name": "Десерт", "time": "21:00", "items": [
        {"dish_id": "dessert_curd_banana_choc"},
    ]},
]

OFFICE_DAY_TEMPLATE = [
    {"num": 1, "name": "Вода", "time": "07:30", "items": [{"dish_id": "water_250"}]},
    {"num": 2, "name": "Завтрак Цех 85", "time": "08:30", "items": [
        {"dish_id": "ts_15_carry_sandwich"},
        {"dish_id": "ts_14_cinnamon_roll"},
    ], "tags": ["sweet_breakfast"]},
    {"num": 3, "name": "Кофе офис", "time": "10:00", "items": [{"dish_id": "office_coffee"}]},
    {"num": 4, "name": "Adrenaline", "time": "10:30", "items": [{"dish_id": "adrenaline_zero"}]},
    {"num": 5, "name": "Обед", "time": "13:00", "items": [
        {"dish_id": "main_a"},
        {"dish_id": "marmalade_30g", "tail": True},
    ]},
    {"num": 6, "name": "Ужин", "time": "18:30", "items": [
        {"dish_id": "main_a"},
        {"dish_id": "chocolate_dark_20g", "tail": True},
    ]},
    {"num": 7, "name": "Десерт", "time": "21:00", "items": [
        {"dish_id": "ds_04_tiramisu_ll"},
    ]},
]

HOME_DAY_TEMPLATE = [
    {"num": 1, "name": "Кофе", "time": "09:00", "items": [{"dish_id": "coffee_with_milk"}]},
    {"num": 2, "name": "Завтрак", "time": "09:30", "items": [
        {"dish_id": "shawarma_bowl_sat"},
        {"dish_id": "chocolate_dark_20g", "tail": True},
    ]},
    {"num": 3, "name": "Обед", "time": "13:00", "items": [
        {"dish_id": "main_b"},
        {"dish_id": "half_snickers", "tail": True},
    ]},
    {"num": 4, "name": "Ужин", "time": "18:30", "items": [
        {"dish_id": "main_b"},
        {"dish_id": "chocolate_dark_15g", "tail": True},
    ]},
    {"num": 5, "name": "Десерт", "time": "21:00", "items": [
        {"dish_id": "dessert_curd_banana_choc_large"},
    ]},
]

SUNDAY_TEMPLATE = [
    {"num": 1, "name": "Кофе (последний до 11:00)", "time": "09:00", "items": [{"dish_id": "coffee_with_milk"}]},
    {"num": 2, "name": "Завтрак", "time": "09:30", "items": [
        {"dish_id": "quesadilla_sun"},
        {"dish_id": "chocolate_no_dairy_20g", "tail": True},
    ], "tags": ["before_iron_window"]},
    {"num": 3, "name": "⛔ Стоп-кофе", "time": "11:00", "items": [],
     "tags": ["iron_window_start"], "notes": "Последний кофе/чай до 15:00"},
    {"num": 4, "name": "Обед ⭐", "time": "13:00", "items": [
        {"dish_id": "main_c"},
        {"dish_id": "chocolate_no_dairy_20g", "tail": True},
    ], "tags": ["iron_meal", "no_dairy"]},
    {"num": 5, "name": "✅ Кофе разрешён", "time": "15:00", "items": [], "tags": ["iron_window_end"]},
    {"num": 6, "name": "Ужин ⭐", "time": "18:30", "items": [
        {"dish_id": "main_c"},
        {"dish_id": "chocolate_no_dairy_20g", "tail": True},
    ], "tags": ["iron_meal", "no_dairy"]},
    {"num": 7, "name": "Десерт", "time": "21:00", "items": [
        {"dish_id": "ds_01_sochen_ll_strawberry"},
    ]},
]

DAY_TEMPLATES = {
    "training": TRAINING_DAY_TEMPLATE,
    "office": OFFICE_DAY_TEMPLATE,
    "home": HOME_DAY_TEMPLATE,
    "sunday_batch": SUNDAY_TEMPLATE,
}


def _next_week_id() -> str:
    """Compute next ISO week id from today."""
    today = datetime.date.today()
    iso = today.isocalendar()
    # If we're past Wed, default to next week
    if today.weekday() >= 3:
        next_week = today + datetime.timedelta(days=7)
        iso = next_week.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _week_dates(week_id: str) -> tuple[str, str]:
    """Parse 'YYYY-Wnn' to (start_date, end_date) ISO strings (Mon-Sun)."""
    year, week = week_id.split("-W")
    year, week = int(year), int(week)
    monday = datetime.date.fromisocalendar(year, week, 1)
    sunday = monday + datetime.timedelta(days=6)
    return monday.isoformat(), sunday.isoformat()


def interactive_create(output: Optional[Path] = None, week_id: Optional[str] = None) -> None:
    """Run interactive plan creation."""
    console.rule("[bold magenta]Создание нового недельного плана[/]")

    library = load_dishes_library()
    available_dishes = list(library.dishes.keys())

    # 1. Week ID and dates
    if not week_id:
        suggested = _next_week_id()
        week_id = questionary.text(
            f"Week ID (формат YYYY-Wnn)",
            default=suggested,
        ).ask()
    start_date, end_date = _week_dates(week_id)
    console.print(f"  Период: [cyan]{start_date}[/] → [cyan]{end_date}[/]")

    # 2. Targets
    default_kcal = 2455
    default_protein = 161
    default_fat = 90
    default_carbs = 250
    if questionary.confirm("Использовать стандартные КБЖУ-цели (2455 / 161 / 90 / 250)?", default=True).ask():
        targets = NutritionTargets(
            kcal_per_day=default_kcal,
            protein_g_per_day=default_protein,
            fat_g_per_day=default_fat,
            carbs_g_per_day=default_carbs,
        )
    else:
        kcal = int(questionary.text("Целевые ккал/день:", default=str(default_kcal)).ask())
        protein = int(questionary.text("Целевой белок г/день:", default=str(default_protein)).ask())
        fat = int(questionary.text("Целевой жир г/день:", default=str(default_fat)).ask())
        carbs = int(questionary.text("Целевые углеводы г/день:", default=str(default_carbs)).ask())
        targets = NutritionTargets(
            kcal_per_day=kcal,
            protein_g_per_day=protein,
            fat_g_per_day=fat,
            carbs_g_per_day=carbs,
        )

    # 3. Budget
    budget_rub = int(questionary.text("Бюджет ₽/неделя:", default="6000").ask())
    budget = Budget(target_rub_per_week=budget_rub, soft_cap_rub=int(budget_rub * 1.15))

    # 4. Days
    console.print("\n[bold]Выбор шаблона для каждого дня:[/]")
    days = []
    monday = datetime.date.fromisoformat(start_date)
    for i, day_name in enumerate(DAY_NAMES):
        day_date = (monday + datetime.timedelta(days=i)).isoformat()
        # Suggest default
        if day_name in ("Пн", "Чт"):
            default_template = "training"
            day_type = "training"
        elif day_name in ("Вт", "Ср", "Пт"):
            default_template = "office"
            day_type = "office"
        elif day_name == "Сб":
            default_template = "home"
            day_type = "home"
        else:  # Вс
            default_template = "sunday_batch"
            day_type = "home"

        template_choice = questionary.select(
            f"{day_name} ({day_date}) — какой шаблон?",
            choices=[
                questionary.Choice("Тренировочный (Пн/Чт)", value="training"),
                questionary.Choice("Офисный (Вт/Ср/Пт)", value="office"),
                questionary.Choice("Домашний (Сб)", value="home"),
                questionary.Choice("Воскресный с batch-cook + железо", value="sunday_batch"),
                questionary.Choice("Пустой (заполню вручную)", value="empty"),
            ],
            default=default_template,
        ).ask()

        if day_type == "training":
            day_type = "training" if template_choice == "training" else (
                "office" if template_choice == "office" else "home"
            )
        else:
            day_type = "training" if template_choice == "training" else (
                "office" if template_choice == "office" else "home"
            )

        meals = []
        if template_choice != "empty":
            template = DAY_TEMPLATES[template_choice]
            for meal_data in template:
                items = [MealItem(**i) for i in meal_data["items"]]
                meals.append(Meal(
                    num=meal_data["num"],
                    name=meal_data["name"],
                    time=meal_data["time"],
                    items=items,
                    tags=meal_data.get("tags", []),
                    notes=meal_data.get("notes"),
                ))
        days.append(Day(
            day=day_name,
            day_type=day_type,
            date=day_date,
            meals=meals,
        ))

    # 5. Stock (defaults from previous week)
    use_default_stock = questionary.confirm("Использовать стандартный stock_at_home (Milky Way, чай, кофе, Терияки, Гочуджан, рисовая бумага)?", default=True).ask()
    stock = []
    if use_default_stock:
        stock = [
            StockItem(ref="local:mw_mini", qty_units=3, note="3 шт уже дома"),
            StockItem(ref="local:tea_basic", qty_units=1),
            StockItem(ref="local:instant_coffee", qty_units=1),
            StockItem(ref="local:rice_paper", qty_units=1),
            StockItem(ref="local:teriyaki_home", qty_units=1),
            StockItem(ref="local:gochujang_home", qty_units=1),
            StockItem(ref="local:spices_home", qty_units=1),
        ]

    # Build the plan
    plan = WeekPlan(
        week_id=week_id,
        start_date=start_date,
        end_date=end_date,
        nutrition_targets=targets,
        budget=budget,
        stock_at_home=stock,
        schedule=days,
    )

    # 6. Save
    if not output:
        output = PLANS_DIR / f"week_{week_id}.json"
    PLANS_DIR.mkdir(exist_ok=True)
    with output.open("w", encoding="utf-8") as f:
        json.dump(plan.model_dump(exclude_none=False), f, ensure_ascii=False, indent=2)
    console.print(f"\n[green]✓ План сохранён: {output}[/]")
    console.print(f"\nДалее можно прогнать:")
    console.print(f"  python -m meal_planner all {output}")
