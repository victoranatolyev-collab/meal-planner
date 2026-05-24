"""
Shopping list generator.

Aggregates all ingredients from a week plan, accounts for home stock,
groups by shop and packaging, and outputs CSV.
"""

from __future__ import annotations
import csv
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .resolver import ResolvedWeek, ResolvedIngredient, Resolver, load_week_plan
from .schema import WeekPlan
from .catalog import NormalizedIngredient


@dataclass
class ShoppingItem:
    """One row in the shopping list."""

    ref: str
    name: str
    shop: str
    plu: Optional[str] = None
    code: Optional[str] = None
    qty_total_g: float = 0  # total grams needed across week
    qty_packages: float = 0  # how many packages to buy (if pkg-based)
    qty_buy_kg: float = 0  # how many kg to buy (if weight-based)
    unit: str = "шт"
    weight_g_per_package: float = 0
    price_per_unit: float = 0  # per package or per kg
    price_total_rub: float = 0
    category: Optional[str] = None
    note: Optional[str] = None
    from_stock: bool = False  # if True, don't include in shopping (already at home)


def aggregate_ingredients(resolved: ResolvedWeek) -> dict[str, dict]:
    """Group resolved ingredients by ref, sum quantities."""
    aggregated: dict[str, dict] = {}

    for day in resolved.days:
        for meal in day.meals:
            for item in meal.items:
                for ing in item.ingredients:
                    if ing.ref not in aggregated:
                        aggregated[ing.ref] = {
                            "ref": ing.ref,
                            "name": ing.name,
                            "shop": ing.shop or "—",
                            "qty_total_g": 0,
                            "qty_total_units": 0,
                            "from_stock_uses": 0,
                            "total_uses": 0,
                            "unit": ing.unit,
                        }
                    aggregated[ing.ref]["qty_total_g"] += ing.qty_g
                    aggregated[ing.ref]["qty_total_units"] += ing.qty_units
                    aggregated[ing.ref]["total_uses"] += 1
                    if ing.from_stock:
                        aggregated[ing.ref]["from_stock_uses"] += 1

    return aggregated


def compute_shopping_items(
    resolved: ResolvedWeek,
    week: WeekPlan,
    resolver: Resolver,
) -> list[ShoppingItem]:
    """Compute shopping items from aggregated ingredients."""
    aggregated = aggregate_ingredients(resolved)
    catalog = resolver.catalog.with_week_overrides(week)
    stock_refs = {s.ref for s in week.stock_at_home}

    items: list[ShoppingItem] = []
    NON_SHOPPING_SHOPS = {None, "—", "офис", "дома"}  # not a real shopping destination
    for ref, agg in aggregated.items():
        # Skip items that are in stock_at_home regardless of per-use flag
        if ref in stock_refs:
            continue

        ing: Optional[NormalizedIngredient] = catalog.resolve(ref)
        if not ing:
            items.append(ShoppingItem(
                ref=ref,
                name=f"<unresolved:{ref}>",
                shop="—",
                qty_total_g=agg["qty_total_g"],
                note="UNRESOLVED",
            ))
            continue

        # Skip items that aren't actually purchased (вода, офисный кофе, и т.д.)
        if ing.shop in NON_SHOPPING_SHOPS:
            continue

        qty_g = agg["qty_total_g"]
        qty_units = agg["qty_total_units"]

        # Determine how to buy
        weight_g_per_pkg = ing.weight_g
        price_per_unit = ing.price_rub
        price_per_kg = ing.price_per_kg

        if ing.unit == "кг" or price_per_kg is not None:
            # Weight-based pricing — buy in kg
            qty_buy_kg = qty_g / 1000.0 if qty_g > 0 else 0
            qty_packages = 0
            unit_for_buying = "кг"
            price_total = (price_per_kg or 0) * qty_buy_kg
        elif weight_g_per_pkg > 0:
            # Package-based — calculate how many packages
            qty_needed_g = qty_g if qty_g > 0 else (qty_units * weight_g_per_pkg)
            qty_packages = math.ceil(qty_needed_g / weight_g_per_pkg) if qty_needed_g > 0 else 0
            qty_buy_kg = 0
            unit_for_buying = ing.unit or "шт"
            price_total = price_per_unit * qty_packages
        else:
            # Unit-based without weight (e.g., eggs, cans)
            qty_packages = math.ceil(qty_units) if qty_units > 0 else 0
            qty_buy_kg = 0
            unit_for_buying = ing.unit or "шт"
            price_total = price_per_unit * qty_packages

        items.append(ShoppingItem(
            ref=ref,
            name=ing.name,
            shop=ing.shop or "—",
            plu=ing.plu,
            code=ing.code,
            qty_total_g=round(qty_g, 1),
            qty_packages=qty_packages,
            qty_buy_kg=round(qty_buy_kg, 3),
            unit=unit_for_buying,
            weight_g_per_package=weight_g_per_pkg,
            price_per_unit=price_per_unit if not price_per_kg else (price_per_kg or 0),
            price_total_rub=round(price_total, 2),
            category=ing.category,
            from_stock=(ref in stock_refs),
        ))

    # Sort: by shop priority, then by category
    SHOP_ORDER = {"Пятёрочка": 1, "Цех 85": 2, "ЛЛ": 3, "Маркетплейс": 4, "дома": 5, "офис": 6, "—": 99}
    items.sort(key=lambda x: (SHOP_ORDER.get(x.shop, 99), x.category or "", x.name))
    return items


def write_shopping_csv(items: list[ShoppingItem], path: Path) -> None:
    """Write items to CSV file."""
    fieldnames = [
        "shop", "plu", "code", "name", "category",
        "qty_total_g", "qty_packages", "qty_buy_kg",
        "weight_g_per_package", "price_per_unit", "price_total_rub",
        "from_stock", "note", "ref",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow({
                "shop": item.shop,
                "plu": item.plu or "",
                "code": item.code or "",
                "name": item.name,
                "category": item.category or "",
                "qty_total_g": item.qty_total_g,
                "qty_packages": item.qty_packages,
                "qty_buy_kg": item.qty_buy_kg,
                "weight_g_per_package": item.weight_g_per_package,
                "price_per_unit": item.price_per_unit,
                "price_total_rub": item.price_total_rub,
                "from_stock": "TRUE" if item.from_stock else "FALSE",
                "note": item.note or "",
                "ref": item.ref,
            })


def summarize_by_shop(items: list[ShoppingItem]) -> dict[str, dict]:
    """Group totals by shop."""
    summary: dict[str, dict] = {}
    for item in items:
        if item.from_stock:
            continue
        if item.shop not in summary:
            summary[item.shop] = {"total_rub": 0, "count": 0}
        summary[item.shop]["total_rub"] += item.price_total_rub
        summary[item.shop]["count"] += 1
    return summary


def generate_shopping(plan_path: Path, output_path: Path) -> None:
    """End-to-end: load plan → resolve → write shopping CSV."""
    plan = load_week_plan(plan_path)
    resolver = Resolver()
    resolved = resolver.resolve_week(plan)
    items = compute_shopping_items(resolved, plan, resolver)
    write_shopping_csv(items, output_path)
    summary = summarize_by_shop(items)
    print(f"✓ Shopping list → {output_path}")
    print(f"  Total items: {len([i for i in items if not i.from_stock])}")
    print(f"  Summary by shop:")
    total = 0.0
    for shop, info in summary.items():
        print(f"    {shop:15s} {info['count']:3d} поз. {info['total_rub']:>10.2f}₽")
        total += info["total_rub"]
    print(f"  {'ИТОГО':15s}            {total:>10.2f}₽")
