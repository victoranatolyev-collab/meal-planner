"""
Order matcher: compares planned vs actual purchase.

Inputs:
- WeekPlan (with shopping list derived)
- WeekPlan.actual_orders[] (one or more actual orders)

Outputs report with:
- Items in plan but not in order (missing)
- Items in order but not in plan (extra)
- Items with quantity discrepancies
- Items with price discrepancies (vs catalog regular_price)
- Total cost: plan vs actual
"""

from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich import box

from .resolver import Resolver, load_week_plan
from .schema import WeekPlan, OrderItem, ActualOrder
from .shopping import compute_shopping_items, ShoppingItem


@dataclass
class MatchedItem:
    """A single match/mismatch between plan and order."""

    status: str  # "match" | "missing" | "extra" | "qty_diff" | "price_diff" | "substitution"
    plan_item: Optional[ShoppingItem]
    order_item: Optional[OrderItem]
    diff_qty: float = 0
    diff_price: float = 0
    note: Optional[str] = None


def match_orders(plan: WeekPlan, planned_items: list[ShoppingItem]) -> list[MatchedItem]:
    """Match planned items vs actual purchase orders.

    Match keys (priority): PLU > name fuzzy match.
    """
    if not plan.actual_orders:
        return []

    # Collect all actual items
    actual_items: list[OrderItem] = []
    for order in plan.actual_orders:
        actual_items.extend(order.items)

    # Build PLU and name maps for actuals
    actual_by_plu = {a.plu: a for a in actual_items if a.plu}

    matched_actual_ids = set()  # track which actuals were matched
    results: list[MatchedItem] = []

    # 1. For each planned item, find match in actual
    for plan_item in planned_items:
        if plan_item.from_stock or plan_item.shop != "Пятёрочка":
            continue  # we match only Пятёрочка items vs actual order

        # Try PLU match first
        matched_actual: Optional[OrderItem] = None
        if plan_item.plu and plan_item.plu in actual_by_plu:
            matched_actual = actual_by_plu[plan_item.plu]
            matched_actual_ids.add(id(matched_actual))
        else:
            # Try name fuzzy match (substring)
            for actual in actual_items:
                if id(actual) in matched_actual_ids:
                    continue
                # Take first 15 chars of plan name and search in actual names
                if plan_item.name[:15].lower() in actual.name.lower() or actual.name[:15].lower() in plan_item.name.lower():
                    matched_actual = actual
                    matched_actual_ids.add(id(actual))
                    break

        if not matched_actual:
            results.append(MatchedItem(status="missing", plan_item=plan_item, order_item=None))
            continue

        # Compare quantities (in grams or units)
        plan_qty_g = plan_item.qty_total_g
        # Actual qty in units * weight, or kg conversion
        if matched_actual.unit == "кг":
            actual_qty_g = matched_actual.qty * 1000
        elif plan_item.weight_g_per_package > 0:
            actual_qty_g = matched_actual.qty * plan_item.weight_g_per_package
        else:
            actual_qty_g = matched_actual.qty * 100  # fallback

        diff_qty = actual_qty_g - plan_qty_g

        # Compare prices
        plan_price = plan_item.price_total_rub
        actual_price = matched_actual.price_rub_total
        diff_price = actual_price - plan_price

        # Determine status
        status = "match"
        if abs(diff_qty) > plan_qty_g * 0.15 and plan_qty_g > 0:
            status = "qty_diff"
        elif abs(diff_price) > plan_price * 0.20 and plan_price > 0:
            status = "price_diff"

        results.append(MatchedItem(
            status=status,
            plan_item=plan_item,
            order_item=matched_actual,
            diff_qty=round(diff_qty, 1),
            diff_price=round(diff_price, 2),
        ))

    # 2. Find extras (actuals not matched)
    for actual in actual_items:
        if id(actual) not in matched_actual_ids:
            results.append(MatchedItem(status="extra", plan_item=None, order_item=actual))

    return results


def print_match_report(plan_path: Path) -> None:
    """Run and print match report."""
    plan = load_week_plan(plan_path)
    resolver = Resolver()
    resolved = resolver.resolve_week(plan)
    planned_items = compute_shopping_items(resolved, plan, resolver)
    matches = match_orders(plan, planned_items)

    console = Console()
    console.rule(f"[bold magenta]Order Match Report: {plan.week_id}[/]")

    # Group by status
    by_status = {"match": [], "missing": [], "extra": [], "qty_diff": [], "price_diff": []}
    for m in matches:
        by_status.setdefault(m.status, []).append(m)

    # Summary
    summary = Table(box=box.ROUNDED, title="Сводка")
    summary.add_column("Статус")
    summary.add_column("Кол-во", justify="right")
    icons = {"match": "✅", "missing": "❌", "extra": "➕", "qty_diff": "⚖️", "price_diff": "💰"}
    for status, items in by_status.items():
        if not items:
            continue
        summary.add_row(f"{icons.get(status, '?')} {status}", str(len(items)))
    console.print(summary)
    console.print()

    # Detailed tables
    for status in ["missing", "extra", "qty_diff", "price_diff"]:
        items = by_status.get(status, [])
        if not items:
            continue
        title = {
            "missing": "❌ В плане, но НЕ куплено",
            "extra": "➕ Куплено, но НЕТ в плане",
            "qty_diff": "⚖️ Расхождение по количеству (>15%)",
            "price_diff": "💰 Расхождение по цене (>20%)",
        }[status]
        t = Table(title=title, box=box.ROUNDED)
        if status == "missing":
            t.add_column("Товар")
            t.add_column("План кол-во")
            t.add_column("План ₽", justify="right")
            for m in items:
                p = m.plan_item
                t.add_row(p.name[:50], f"{p.qty_total_g:.0f}г / {p.qty_packages}шт", f"{p.price_total_rub:.2f}")
        elif status == "extra":
            t.add_column("Товар")
            t.add_column("Кол-во")
            t.add_column("Цена ₽", justify="right")
            for m in items:
                a = m.order_item
                t.add_row(a.name[:50], f"{a.qty} {a.unit}", f"{a.price_rub_total:.2f}")
        elif status == "qty_diff":
            t.add_column("Товар")
            t.add_column("План г")
            t.add_column("Факт г")
            t.add_column("Δ г")
            for m in items:
                p = m.plan_item
                t.add_row(p.name[:40], f"{p.qty_total_g:.0f}", f"{p.qty_total_g + m.diff_qty:.0f}", f"{m.diff_qty:+.0f}")
        elif status == "price_diff":
            t.add_column("Товар")
            t.add_column("План ₽")
            t.add_column("Факт ₽")
            t.add_column("Δ ₽")
            for m in items:
                p = m.plan_item
                a = m.order_item
                t.add_row(p.name[:40], f"{p.price_total_rub:.2f}", f"{a.price_rub_total:.2f}", f"{m.diff_price:+.2f}")
        console.print(t)
        console.print()

    # Cost summary
    plan_total = sum(p.price_total_rub for p in planned_items if not p.from_stock and p.shop == "Пятёрочка")
    actual_total = sum(a.price_rub_total for o in plan.actual_orders for a in o.items)
    fees = sum(o.packing_fee_rub + o.delivery_fee_rub - o.discount_rub for o in plan.actual_orders)
    cost = Table(title="Итог: план vs факт (Пятёрочка)", box=box.ROUNDED)
    cost.add_column("")
    cost.add_column("План ₽", justify="right")
    cost.add_column("Факт ₽", justify="right")
    cost.add_column("Δ ₽", justify="right")
    diff = actual_total + fees - plan_total
    color = "green" if diff <= 0 else "red"
    cost.add_row("Товары", f"{plan_total:.2f}", f"{actual_total:.2f}", f"[{color}]{actual_total - plan_total:+.2f}[/{color}]")
    cost.add_row("Сборка - Скидки", "—", f"{fees:.2f}", "—")
    cost.add_row("[bold]ИТОГО[/bold]", f"[bold]{plan_total:.2f}[/bold]", f"[bold]{actual_total + fees:.2f}[/bold]", f"[bold {color}]{diff:+.2f}[/bold {color}]")
    console.print(cost)
