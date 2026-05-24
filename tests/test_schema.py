"""Schema validation tests."""
import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from meal_planner.schema import (
    WeekPlan, DishesLibrary, CustomIngredients,
    NutritionTargets, Budget, Day, Meal, MealItem, IngredientRef, Dish,
)


def test_minimal_week_plan_validates():
    plan = WeekPlan(
        week_id="2026-W21",
        start_date="2026-05-18",
        end_date="2026-05-24",
        nutrition_targets=NutritionTargets(
            kcal_per_day=2455, protein_g_per_day=161, fat_g_per_day=90, carbs_g_per_day=250
        ),
        budget=Budget(target_rub_per_week=6000),
        schedule=[Day(day="Пн", day_type="training", date="2026-05-18", meals=[])],
    )
    assert plan.week_id == "2026-W21"
    assert len(plan.schedule) == 1


def test_actual_plan_loads(plan_path: Path):
    with plan_path.open(encoding="utf-8") as f:
        data = json.load(f)
    plan = WeekPlan(**data)
    assert plan.week_id == "2026-W21"
    assert len(plan.schedule) == 7
    assert plan.actual_orders, "должен быть фактический заказ"


def test_dishes_library_loads(project_root: Path):
    with (project_root / "data/dishes_library.json").open(encoding="utf-8") as f:
        data = json.load(f)
    lib = DishesLibrary(**data)
    assert len(lib.dishes) > 20
    assert "main_a" in lib.dishes


def test_custom_ingredients_loads(project_root: Path):
    with (project_root / "data/custom_ingredients.json").open(encoding="utf-8") as f:
        data = json.load(f)
    ci = CustomIngredients(**data)
    assert "mw_mini" in ci.ingredients
    assert ci.ingredients["mw_mini"].shop == "дома"


def test_invalid_day_raises():
    with pytest.raises(ValidationError):
        Day(day="Понедельник", day_type="training", date="2026-05-18", meals=[])


def test_invalid_day_type_raises():
    with pytest.raises(ValidationError):
        Day(day="Пн", day_type="rest", date="2026-05-18", meals=[])


def test_meal_with_items():
    meal = Meal(num=1, name="Завтрак", time="08:30", items=[
        MealItem(dish_id="main_a", portion=1.0),
        MealItem(dish_id="mw_mini", tail=True, from_stock=True),
    ])
    assert len(meal.items) == 2
    assert meal.items[1].tail is True


def test_extra_fields_forbidden():
    # extra="forbid" → unknown fields should raise
    with pytest.raises(ValidationError):
        Day(day="Пн", day_type="training", date="2026-05-18", meals=[], unknown_field=42)
