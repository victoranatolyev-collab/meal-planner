"""
Resolver: combines WeekPlan + DishesLibrary + Catalog → fully resolved meals.

Computes:
- per-meal KBJU (kcal, protein, fat, carbs)
- per-meal cost (only items NOT from_stock)
- ingredient list with grams and source names
- cumulative day KBJU
- day totals
"""

from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .schema import WeekPlan, DishesLibrary, Dish, Meal, MealItem
from .catalog import Catalog, NormalizedIngredient
from .config import DATA_DIR


@dataclass
class ResolvedIngredient:
    """One ingredient with source, qty, KBJU, cost."""

    ref: str
    name: str
    shop: Optional[str]
    qty_g: float
    qty_units: float
    unit: str
    kcal: float
    protein_g: float
    fat_g: float
    carbs_g: float
    cost_rub: float
    from_stock: bool = False
    fresh_addon: bool = False
    note: Optional[str] = None


@dataclass
class ResolvedItem:
    """One meal item (dish or single ingredient) with totals."""

    dish_id: Optional[str]
    dish_name: Optional[str]
    portion: float
    label: Optional[str]
    is_tail: bool
    from_stock: bool
    ingredients: list[ResolvedIngredient]

    @property
    def kcal(self) -> float:
        return round(sum(i.kcal for i in self.ingredients), 1)

    @property
    def protein_g(self) -> float:
        return round(sum(i.protein_g for i in self.ingredients), 2)

    @property
    def fat_g(self) -> float:
        return round(sum(i.fat_g for i in self.ingredients), 2)

    @property
    def carbs_g(self) -> float:
        return round(sum(i.carbs_g for i in self.ingredients), 2)

    @property
    def cost_rub(self) -> float:
        return round(sum(i.cost_rub for i in self.ingredients), 2)


@dataclass
class ResolvedMeal:
    """A meal with all items resolved."""

    num: int
    name: str
    time: str
    items: list[ResolvedItem]
    tags: list[str]
    notes: Optional[str]
    cumulative_kcal: float = 0  # set by day-level pass

    @property
    def kcal(self) -> float:
        return round(sum(i.kcal for i in self.items), 1)

    @property
    def protein_g(self) -> float:
        return round(sum(i.protein_g for i in self.items), 2)

    @property
    def fat_g(self) -> float:
        return round(sum(i.fat_g for i in self.items), 2)

    @property
    def carbs_g(self) -> float:
        return round(sum(i.carbs_g for i in self.items), 2)


@dataclass
class ResolvedDay:
    """A day with all meals resolved."""

    day: str
    day_type: str
    date: str
    meals: list[ResolvedMeal]
    notes: Optional[str]

    @property
    def kcal_total(self) -> float:
        return round(sum(m.kcal for m in self.meals), 1)

    @property
    def protein_g_total(self) -> float:
        return round(sum(m.protein_g for m in self.meals), 2)

    @property
    def fat_g_total(self) -> float:
        return round(sum(m.fat_g for m in self.meals), 2)

    @property
    def carbs_g_total(self) -> float:
        return round(sum(m.carbs_g for m in self.meals), 2)


@dataclass
class ResolvedWeek:
    """Full resolved week plan."""

    week_id: str
    start_date: str
    end_date: str
    targets: dict
    budget_target_rub: float
    days: list[ResolvedDay]
    unresolved_refs: list[str] = field(default_factory=list)  # collect any missing ingredients

    @property
    def kcal_total(self) -> float:
        return round(sum(d.kcal_total for d in self.days), 1)


class Resolver:
    """Resolves a WeekPlan against DishesLibrary + Catalog."""

    def __init__(
        self,
        catalog: Optional[Catalog] = None,
        dishes_library: Optional[DishesLibrary] = None,
    ):
        self.catalog = catalog or Catalog()
        if dishes_library is None:
            dishes_library = load_dishes_library()
        self.library = dishes_library
        self.unresolved: list[str] = []

    def _get_dish(self, dish_id: str, week: WeekPlan) -> Optional[Dish]:
        """Look up dish in week.dishes first (override), then in library."""
        return week.dishes.get(dish_id) or self.library.dishes.get(dish_id)

    def _resolve_ingredient(
        self,
        ref: str,
        qty_g: float,
        qty_units: float,
        portion_mult: float,
        from_stock: bool,
        fresh_addon: bool,
        note: Optional[str],
    ) -> ResolvedIngredient:
        """Resolve one ingredient ref → ResolvedIngredient with KBJU/cost."""
        ing = self.catalog.resolve(ref)
        if not ing:
            self.unresolved.append(ref)
            return ResolvedIngredient(
                ref=ref,
                name=f"<unresolved:{ref}>",
                shop=None,
                qty_g=qty_g * portion_mult,
                qty_units=qty_units * portion_mult,
                unit="?",
                kcal=0, protein_g=0, fat_g=0, carbs_g=0, cost_rub=0,
                from_stock=from_stock,
                fresh_addon=fresh_addon,
                note=note,
            )

        actual_g = qty_g * portion_mult
        actual_units = qty_units * portion_mult
        # If qty_g is 0 but qty_units is set, derive grams from weight_g
        if actual_g == 0 and actual_units > 0 and ing.weight_g > 0:
            actual_g = actual_units * ing.weight_g

        kbju = ing.kbju(actual_g) if actual_g > 0 else {"kcal": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
        cost = ing.cost(qty_g=actual_g, qty_units=actual_units) if not from_stock else 0

        return ResolvedIngredient(
            ref=ref,
            name=ing.name,
            shop=ing.shop,
            qty_g=round(actual_g, 1),
            qty_units=round(actual_units, 2),
            unit=ing.unit,
            kcal=kbju["kcal"],
            protein_g=kbju["protein_g"],
            fat_g=kbju["fat_g"],
            carbs_g=kbju["carbs_g"],
            cost_rub=cost,
            from_stock=from_stock,
            fresh_addon=fresh_addon,
            note=note,
        )

    def _resolve_meal_item(self, item: MealItem, week: WeekPlan) -> ResolvedItem:
        """Resolve a single meal item (dish + portion or direct ingredient)."""
        portion = item.portion
        from_stock = item.from_stock

        if item.dish_id:
            dish = self._get_dish(item.dish_id, week)
            if not dish:
                self.unresolved.append(f"dish:{item.dish_id}")
                return ResolvedItem(
                    dish_id=item.dish_id,
                    dish_name=f"<unresolved dish:{item.dish_id}>",
                    portion=portion,
                    label=item.label,
                    is_tail=item.tail,
                    from_stock=from_stock,
                    ingredients=[],
                )
            resolved_ingredients = [
                self._resolve_ingredient(
                    ref=ing.ref,
                    qty_g=ing.qty_g,
                    qty_units=ing.qty_units,
                    portion_mult=portion,
                    from_stock=from_stock,
                    fresh_addon=ing.fresh_addon,
                    note=ing.note,
                )
                for ing in dish.ingredients
            ]
            return ResolvedItem(
                dish_id=item.dish_id,
                dish_name=dish.name,
                portion=portion,
                label=item.label,
                is_tail=item.tail,
                from_stock=from_stock,
                ingredients=resolved_ingredients,
            )

        # Direct ingredient reference
        if item.ingredient_ref:
            qty_g = item.qty_g or 0
            qty_units = item.qty_units or 0
            ing = self._resolve_ingredient(
                ref=item.ingredient_ref,
                qty_g=qty_g,
                qty_units=qty_units,
                portion_mult=1.0,  # direct refs ignore portion mult
                from_stock=from_stock,
                fresh_addon=False,
                note=None,
            )
            return ResolvedItem(
                dish_id=None,
                dish_name=ing.name,
                portion=1.0,
                label=item.label,
                is_tail=item.tail,
                from_stock=from_stock,
                ingredients=[ing],
            )

        # Empty item (e.g., iron_window_start marker)
        return ResolvedItem(
            dish_id=None,
            dish_name=item.label or "—",
            portion=1.0,
            label=item.label,
            is_tail=item.tail,
            from_stock=from_stock,
            ingredients=[],
        )

    def resolve_week(self, week: WeekPlan) -> ResolvedWeek:
        """Resolve full week plan."""
        self.unresolved = []
        # Apply week's local ingredient overrides
        catalog_with_overrides = self.catalog.with_week_overrides(week)
        original_catalog = self.catalog
        self.catalog = catalog_with_overrides

        try:
            days: list[ResolvedDay] = []
            for day in week.schedule:
                meals: list[ResolvedMeal] = []
                cum_kcal = 0.0
                for meal in day.meals:
                    items = [self._resolve_meal_item(item, week) for item in meal.items]
                    rm = ResolvedMeal(
                        num=meal.num,
                        name=meal.name,
                        time=meal.time,
                        items=items,
                        tags=meal.tags,
                        notes=meal.notes,
                    )
                    cum_kcal += rm.kcal
                    rm.cumulative_kcal = round(cum_kcal, 1)
                    meals.append(rm)

                days.append(ResolvedDay(
                    day=day.day,
                    day_type=day.day_type,
                    date=day.date,
                    meals=meals,
                    notes=day.notes,
                ))

            return ResolvedWeek(
                week_id=week.week_id,
                start_date=week.start_date,
                end_date=week.end_date,
                targets=week.nutrition_targets.model_dump(),
                budget_target_rub=week.budget.target_rub_per_week,
                days=days,
                unresolved_refs=list(set(self.unresolved)),
            )
        finally:
            self.catalog = original_catalog


def load_week_plan(path: Path) -> WeekPlan:
    """Load and validate a week plan JSON file."""
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return WeekPlan(**data)


def load_dishes_library(path: Optional[Path] = None) -> DishesLibrary:
    """Load dishes library."""
    path = path or (DATA_DIR / "dishes_library.json")
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return DishesLibrary(**data)
