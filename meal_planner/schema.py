"""
JSON Schema for weekly meal plans.

Three top-level files:
- plans/week_*.json       — single source of truth for a week (WeekPlan)
- data/dishes_library.json — reusable dish templates (DishesLibrary)
- data/custom_ingredients.json — non-Пятёрочка items (Цех 85, ЛЛ, дом, Маркетплейс)

Ingredient references use a "ref" string with namespace prefix:
- "plu:3191298"        → look up in data/ingredients_spb.json (Пятёрочка catalog)
- "local:milky_way_mini" → look up in data/custom_ingredients.json
"""

from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


# ──────────────────────────────────────────────────────────────────────────────
# Nutrition targets and budget
# ──────────────────────────────────────────────────────────────────────────────


class NutritionTargets(BaseModel):
    kcal_per_day: float
    protein_g_per_day: float
    fat_g_per_day: float
    carbs_g_per_day: float

    model_config = ConfigDict(extra="forbid")


class Budget(BaseModel):
    target_rub_per_week: float
    soft_cap_rub: Optional[float] = None  # warn if exceeded but don't fail validation

    model_config = ConfigDict(extra="forbid")


# ──────────────────────────────────────────────────────────────────────────────
# Stock (what user has at home — excluded from shopping list)
# ──────────────────────────────────────────────────────────────────────────────


class StockItem(BaseModel):
    ref: str  # "local:milky_way_mini" or "plu:..."
    qty_units: float = 1
    qty_g: Optional[float] = None
    note: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


# ──────────────────────────────────────────────────────────────────────────────
# Local ingredient (override or non-Пятёрочка catalog item)
# ──────────────────────────────────────────────────────────────────────────────


class LocalIngredient(BaseModel):
    """Ingredient not in ingredients_spb.json (Цех 85, ЛЛ, домашние запасы, Маркетплейс)."""

    id: str
    name: str
    shop: Optional[str] = None  # "Цех 85" | "ЛЛ" | "дома" | "Маркетплейс"
    code: Optional[str] = None  # Внутренний код магазина: TS-15, DS-04
    plu: Optional[str] = None  # PLU если есть
    weight_g: float = 0  # граммовка упаковки
    kcal_per_100g: float = 0
    protein_per_100g: float = 0
    fat_per_100g: float = 0
    carbs_per_100g: float = 0
    price_rub: float = 0  # цена за упаковку
    unit: str = "шт"  # шт, кг, упак, бан
    category: Optional[str] = None  # белок, сладкое, напиток, выпечка, и т.д.
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


# ──────────────────────────────────────────────────────────────────────────────
# Dish (recipe template)
# ──────────────────────────────────────────────────────────────────────────────


class IngredientRef(BaseModel):
    """Reference to an ingredient with quantity."""

    ref: str  # "plu:3191298" | "local:milky_way_mini"
    qty_g: float = 0  # for weight-based ingredients
    qty_units: float = 0  # for unit-based (eggs, packets); usually 1.0 with weight in catalog
    note: Optional[str] = None
    fresh_addon: bool = False  # True = add at consumption time, not from batch-cook

    model_config = ConfigDict(extra="forbid")


class Dish(BaseModel):
    """A recipe template — referenced from meals by id."""

    id: str
    name: str
    ingredients: list[IngredientRef]
    prep: Optional[str] = None  # "batch_cook_sunday" | "fresh" | "frozen_thaw" | etc.
    method: Optional[str] = None  # Human-readable cooking instructions
    tags: list[str] = Field(default_factory=list)
    # Examples of tags: post_workout_ok, korean_marinade, iron_meal_no_dairy, sweet, c1_excluded

    model_config = ConfigDict(extra="forbid")


# ──────────────────────────────────────────────────────────────────────────────
# Meal (a single eating event)
# ──────────────────────────────────────────────────────────────────────────────


class MealItem(BaseModel):
    """A single dish/ingredient consumed in a meal."""

    dish_id: Optional[str] = None  # Reference to a dish in dishes_library or week.dishes
    ingredient_ref: Optional[str] = None  # OR direct ingredient ref (for simple items like "Snickers")
    portion: float = 1.0  # multiplier for dish quantities
    qty_g: Optional[float] = None  # override for ingredient_ref direct use
    qty_units: Optional[float] = None
    from_stock: bool = False  # subtract from stock_at_home, don't put in shopping list
    tail: bool = False  # sweet tail (subject to C1 rule)
    label: Optional[str] = None  # display override

    model_config = ConfigDict(extra="forbid")


class Meal(BaseModel):
    num: int  # ordering within the day (1=first, 2=second, ...)
    name: str  # "Завтрак 1", "Обед", "Десерт", "Хвост Завтрака"
    time: str  # "HH:MM"
    items: list[MealItem]
    tags: list[str] = Field(default_factory=list)
    # Examples: pre_workout, post_workout, iron_window_start, iron_window_end, sweet_breakfast
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class Day(BaseModel):
    day: Literal["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    day_type: Literal["training", "office", "home"]
    date: str  # YYYY-MM-DD
    meals: list[Meal]
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


# ──────────────────────────────────────────────────────────────────────────────
# Actual purchase order (for matching)
# ──────────────────────────────────────────────────────────────────────────────


class OrderItem(BaseModel):
    plu: Optional[str] = None
    name: str
    qty: float
    unit: str  # шт, кг, упак
    price_per_unit: Optional[float] = None
    price_rub_total: float
    discount_percent: float = 0

    model_config = ConfigDict(extra="forbid")


class ActualOrder(BaseModel):
    shop: str  # "Пятёрочка"
    order_id: str
    delivered_at: Optional[str] = None  # ISO datetime
    paid_rub: float
    sum_before_discount: Optional[float] = None
    packing_fee_rub: float = 0
    delivery_fee_rub: float = 0
    discount_rub: float = 0  # economy by promotions
    items: list[OrderItem]

    model_config = ConfigDict(extra="forbid")


# ──────────────────────────────────────────────────────────────────────────────
# Top-level documents
# ──────────────────────────────────────────────────────────────────────────────


class WeekPlan(BaseModel):
    """Single source of truth for a week's meal plan."""

    schema_version: str = "weekly_plan_v1"
    week_id: str  # "2026-W21"
    start_date: str  # ISO date, e.g., "2026-05-18"
    end_date: str
    user_profile_ref: str = "../user_profile.json"
    nutrition_targets: NutritionTargets
    budget: Budget
    stock_at_home: list[StockItem] = Field(default_factory=list)
    ingredients_local: dict[str, LocalIngredient] = Field(default_factory=dict)
    dishes: dict[str, Dish] = Field(default_factory=dict)  # week-specific overrides
    schedule: list[Day]
    actual_orders: list[ActualOrder] = Field(default_factory=list)
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class DishesLibrary(BaseModel):
    """Reusable library of dishes shared across weeks."""

    schema_version: str = "dishes_library_v1"
    dishes: dict[str, Dish]
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class CustomIngredients(BaseModel):
    """Ingredients not in ingredients_spb.json (Цех 85, ЛЛ, дом, прочее)."""

    schema_version: str = "custom_ingredients_v1"
    ingredients: dict[str, LocalIngredient]
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")
