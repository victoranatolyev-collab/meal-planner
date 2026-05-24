"""
Report: rich-formatted KBJU/budget/stats summary in terminal.
"""

from __future__ import annotations
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich import box

from .resolver import Resolver, load_week_plan, ResolvedWeek
from .schema import WeekPlan
from .shopping import compute_shopping_items, summarize_by_shop


def make_day_kbju_table(resolved: ResolvedWeek) -> Table:
    """Per-day KBJU table."""
    targets = resolved.targets
    table = Table(title=f"КБЖУ по дням (цель: {targets['kcal_per_day']:.0f}К / {targets['protein_g_per_day']:.0f}Б / {targets['fat_g_per_day']:.0f}Ж / {targets['carbs_g_per_day']:.0f}У)", box=box.ROUNDED)
    table.add_column("День", style="bold cyan")
    table.add_column("Тип", style="dim")
    table.add_column("ккал", justify="right")
    table.add_column("Δ%", justify="right")
    table.add_column("Белок г", justify="right")
    table.add_column("Жир г", justify="right")
    table.add_column("Углев г", justify="right")

    target_kcal = targets["kcal_per_day"]
    for day in resolved.days:
        diff_pct = (day.kcal_total - target_kcal) / target_kcal * 100
        diff_color = "green" if abs(diff_pct) <= 10 else ("yellow" if abs(diff_pct) <= 20 else "red")
        table.add_row(
            day.day,
            day.day_type,
            f"{day.kcal_total:.0f}",
            f"[{diff_color}]{diff_pct:+.1f}%[/{diff_color}]",
            f"{day.protein_g_total:.1f}",
            f"{day.fat_g_total:.1f}",
            f"{day.carbs_g_total:.1f}",
        )

    # Average and target rows
    avg_kcal = sum(d.kcal_total for d in resolved.days) / 7
    avg_protein = sum(d.protein_g_total for d in resolved.days) / 7
    avg_fat = sum(d.fat_g_total for d in resolved.days) / 7
    avg_carbs = sum(d.carbs_g_total for d in resolved.days) / 7
    table.add_section()
    table.add_row(
        "[bold]Среднее[/bold]", "—",
        f"[bold]{avg_kcal:.0f}[/bold]", "—",
        f"[bold]{avg_protein:.1f}[/bold]",
        f"[bold]{avg_fat:.1f}[/bold]",
        f"[bold]{avg_carbs:.1f}[/bold]",
    )
    table.add_row(
        "[bold]Цель[/bold]", "—",
        f"[bold]{targets['kcal_per_day']:.0f}[/bold]", "—",
        f"[bold]{targets['protein_g_per_day']:.0f}[/bold]",
        f"[bold]{targets['fat_g_per_day']:.0f}[/bold]",
        f"[bold]{targets['carbs_g_per_day']:.0f}[/bold]",
    )

    return table


def make_budget_table(plan: WeekPlan, summary: dict) -> Table:
    """Budget by shop."""
    table = Table(title=f"Бюджет (цель ≤{plan.budget.target_rub_per_week:.0f}₽)", box=box.ROUNDED)
    table.add_column("Магазин", style="bold cyan")
    table.add_column("Позиций", justify="right")
    table.add_column("Сумма ₽", justify="right")

    total = 0.0
    for shop, info in summary.items():
        table.add_row(shop, str(info["count"]), f"{info['total_rub']:.2f}")
        total += info["total_rub"]

    table.add_section()
    diff = total - plan.budget.target_rub_per_week
    color = "green" if diff <= 0 else ("yellow" if (plan.budget.soft_cap_rub and total <= plan.budget.soft_cap_rub) else "red")
    table.add_row("[bold]ИТОГО[/bold]", "", f"[bold {color}]{total:.2f}[/bold {color}]")
    table.add_row("[dim]Цель[/dim]", "", f"[dim]{plan.budget.target_rub_per_week:.2f}[/dim]")
    table.add_row("[dim]Разница[/dim]", "", f"[{color}]{diff:+.2f}[/{color}]")

    return table


def make_actual_orders_table(plan: WeekPlan) -> Table | None:
    """Show actual purchase orders."""
    if not plan.actual_orders:
        return None
    table = Table(title="Фактические заказы", box=box.ROUNDED)
    table.add_column("Магазин")
    table.add_column("Заказ #")
    table.add_column("Доставлено")
    table.add_column("Оплачено ₽", justify="right")
    table.add_column("Сборка ₽", justify="right")
    table.add_column("Скидка ₽", justify="right")
    for order in plan.actual_orders:
        table.add_row(
            order.shop,
            order.order_id,
            (order.delivered_at or "")[:16],
            f"{order.paid_rub:.2f}",
            f"{order.packing_fee_rub:.2f}",
            f"{order.discount_rub:.2f}",
        )
    return table


def make_iron_check_table(resolved: ResolvedWeek) -> Table:
    """Iron meal verification — show all Вс meals."""
    table = Table(title="Железо-протокол Вс (Hb 110)", box=box.ROUNDED)
    table.add_column("Время")
    table.add_column("Приём")
    table.add_column("Теги")
    table.add_column("Молочка?", justify="center")
    table.add_column("Кофе/Чай?", justify="center")

    DAIRY_KW = ["молочн", "йогурт", "молоко", "сыр", "творог", "конфет"]
    sunday = next((d for d in resolved.days if d.day == "Вс"), None)
    if not sunday:
        return table
    for meal in sunday.meals:
        ingredients_str = " ".join(i.name.lower() for item in meal.items for i in item.ingredients)
        has_dairy = any(kw in ingredients_str for kw in DAIRY_KW)
        has_coffee = "кофе" in ingredients_str or "чай" in ingredients_str
        is_iron = "iron_meal" in meal.tags
        dairy_mark = "[red]ДА[/red]" if (has_dairy and is_iron) else ("⚠️" if has_dairy else "—")
        coffee_mark = "[red]ДА[/red]" if (has_coffee and 11 <= int(meal.time.split(":")[0]) < 15) else ("⚠️" if has_coffee else "—")
        table.add_row(
            meal.time,
            meal.name,
            ", ".join(meal.tags) if meal.tags else "—",
            dairy_mark,
            coffee_mark,
        )

    return table


def print_report(plan_path: Path) -> None:
    """Print full report to terminal."""
    plan = load_week_plan(plan_path)
    resolver = Resolver()
    resolved = resolver.resolve_week(plan)
    items = compute_shopping_items(resolved, plan, resolver)
    summary = summarize_by_shop(items)

    console = Console()
    console.rule(f"[bold magenta]Weekly Plan Report: {plan.week_id}[/]")
    console.print(f"Период: {plan.start_date} → {plan.end_date}")
    console.print()

    console.print(make_day_kbju_table(resolved))
    console.print()

    console.print(make_budget_table(plan, summary))
    console.print()

    actual = make_actual_orders_table(plan)
    if actual:
        console.print(actual)
        console.print()

    console.print(make_iron_check_table(resolved))

    if resolved.unresolved_refs:
        console.print()
        console.print(f"[bold red]⚠️ Unresolved refs:[/] {resolved.unresolved_refs}")

    if plan.notes:
        console.print()
        console.print(f"[dim italic]ℹ️ {plan.notes}[/dim italic]")
