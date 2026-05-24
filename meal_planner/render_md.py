"""
Render: ResolvedWeek → markdown.

Generates a readable weekly_plan.md from a JSON week plan.
"""

from __future__ import annotations
from pathlib import Path
from typing import Optional

from .resolver import ResolvedWeek, ResolvedDay, ResolvedMeal, ResolvedItem
from .schema import WeekPlan


DAY_EMOJI = {
    "training": "🏋️",
    "office": "🏢",
    "home": "🏠",
}

DAY_TYPE_RU = {
    "training": "трен.",
    "office": "офис",
    "home": "выходной",
}


def render_meal_row(meal: ResolvedMeal) -> str:
    """One row in the daily schedule table."""
    # Format items as bullet list inside cell
    item_strs = []
    for item in meal.items:
        prefix = "❄️ " if "frozen" in (item.dish_name or "").lower() else ""
        stock_mark = " *(из дома)*" if item.from_stock else ""
        tail_mark = " 🍬" if item.is_tail else ""
        label = item.label or item.dish_name or ""
        item_strs.append(f"{prefix}{label}{stock_mark}{tail_mark}")
    items_cell = " + ".join(item_strs) if item_strs else "—"

    kbju = f"**{meal.kcal:.0f}К** / {meal.protein_g:.0f}Б / {meal.fat_g:.0f}Ж / {meal.carbs_g:.0f}У"
    if meal.kcal == 0:
        kbju = "—"

    return f"| {meal.time} | **{meal.name}** — {items_cell} | {kbju} |"


def render_day(day: ResolvedDay) -> str:
    """Markdown block for one day."""
    emoji = DAY_EMOJI.get(day.day_type, "")
    day_type_ru = DAY_TYPE_RU.get(day.day_type, day.day_type)

    header = f"## {day.day} {emoji} ({day_type_ru}) — Σ {day.kcal_total:.0f} ккал / {day.protein_g_total:.0f}Б / {day.fat_g_total:.0f}Ж / {day.carbs_g_total:.0f}У · {day.date}"

    lines = [header, "", "| Время | Приём | KBJU |", "|-------|-------|------|"]
    for meal in day.meals:
        lines.append(render_meal_row(meal))

    if day.notes:
        lines.append("")
        lines.append(f"> {day.notes}")

    return "\n".join(lines)


def render_recipes(week: WeekPlan, resolved: ResolvedWeek, library_dishes: dict, week_dishes: dict) -> str:
    """Render recipes section showing dishes used this week."""
    # Collect all used dish_ids
    used_dish_ids = set()
    for day in resolved.days:
        for meal in day.meals:
            for item in meal.items:
                if item.dish_id:
                    used_dish_ids.add(item.dish_id)

    # Combine week-specific and library dishes
    all_dishes = {**library_dishes, **week_dishes}

    # Filter to "main" dishes (skip simple wrappers like single-ingredient sweet items)
    main_dishes = {
        d_id: d for d_id, d in all_dishes.items()
        if d_id in used_dish_ids and len(d.ingredients) >= 3
    }

    lines = ["# 2️⃣ Рецепты блюд", ""]
    for d_id, dish in sorted(main_dishes.items()):
        lines.append(f"## 🍽 {dish.name}")
        lines.append("")
        if dish.method:
            lines.append(f"**Метод:** {dish.method}")
            lines.append("")
        if dish.prep:
            lines.append(f"**Подготовка:** `{dish.prep}`")
            lines.append("")
        lines.append("| Ингредиент | Кол-во | Примечание |")
        lines.append("|------------|--------|------------|")
        for ing in dish.ingredients:
            note = ing.note or ""
            if ing.fresh_addon:
                note = ("свежий, добавлять в день; " + note).rstrip(" ;")
            qty = f"{ing.qty_g:.0f}г" if ing.qty_g else f"{ing.qty_units:.0f} ед"
            lines.append(f"| `{ing.ref}` | {qty} | {note} |")
        if dish.tags:
            lines.append("")
            lines.append(f"**Теги:** {', '.join(dish.tags)}")
        lines.append("")
    return "\n".join(lines)


def render_actual_order_table(order) -> str:
    """Render actual order block (if present)."""
    lines = [f"### Заказ Пятёрочки №{order.order_id}", ""]
    lines.append(f"- **Доставлен:** {order.delivered_at or '—'}")
    lines.append(f"- **Оплачено:** {order.paid_rub:.2f} ₽")
    lines.append(f"- **Сумма до скидок:** {order.sum_before_discount or 0:.2f} ₽")
    lines.append(f"- **Сборка/упаковка:** {order.packing_fee_rub:.2f} ₽")
    lines.append(f"- **Экономия:** {order.discount_rub:.2f} ₽")
    lines.append("")
    lines.append("| # | PLU | Товар | Кол-во | Цена | Сумма |")
    lines.append("|---|-----|-------|--------|------|-------|")
    for idx, item in enumerate(order.items, 1):
        plu = item.plu or "—"
        ppu = f"{item.price_per_unit:.2f}" if item.price_per_unit else "—"
        lines.append(f"| {idx} | {plu} | {item.name} | {item.qty} {item.unit} | {ppu} | {item.price_rub_total:.2f} |")
    return "\n".join(lines)


def render_week(plan: WeekPlan, resolved: ResolvedWeek) -> str:
    """Render full week → markdown."""
    avg_kcal = resolved.kcal_total / 7 if resolved.days else 0
    targets = resolved.targets

    header = [
        "# Недельный план питания",
        "",
        f"**Неделя:** {plan.week_id} · {plan.start_date} → {plan.end_date}",
        f"**Норма:** {targets['kcal_per_day']:.0f} ккал / {targets['protein_g_per_day']:.0f}Б / "
        f"{targets['fat_g_per_day']:.0f}Ж / {targets['carbs_g_per_day']:.0f}У",
        f"**Бюджет план:** ≤{plan.budget.target_rub_per_week:.0f}₽/нед",
    ]

    if plan.actual_orders:
        total_paid = sum(o.paid_rub for o in plan.actual_orders)
        header.append(f"**Факт неделя (Пятёрочка):** {total_paid:.2f}₽")

    header.append("")
    header.append(f"**КБЖУ факт:** среднее {avg_kcal:.0f} ккал/день (план {targets['kcal_per_day']:.0f})")

    if plan.notes:
        header.append("")
        header.append(f"> ℹ️ {plan.notes}")

    sections = ["\n".join(header)]
    sections.append("\n---\n")
    sections.append("# 1️⃣ Расписание на 7 дней")
    sections.append("")
    for day in resolved.days:
        sections.append(render_day(day))
        sections.append("")
    sections.append("\n---\n")

    # Recipes
    from .resolver import load_dishes_library
    lib = load_dishes_library()
    sections.append(render_recipes(plan, resolved, lib.dishes, plan.dishes))
    sections.append("\n---\n")

    # Actual orders
    if plan.actual_orders:
        sections.append("# 3️⃣ Фактические заказы")
        sections.append("")
        for order in plan.actual_orders:
            sections.append(render_actual_order_table(order))
            sections.append("")
        sections.append("\n---\n")

    # Day KBJU summary
    sections.append("# 4️⃣ КБЖУ сводка по дням")
    sections.append("")
    sections.append("| День | Тип | ккал | Белок г | Жир г | Углеводы г |")
    sections.append("|------|-----|------|---------|-------|------------|")
    for day in resolved.days:
        sections.append(
            f"| {day.day} | {day.day_type} | {day.kcal_total:.0f} | "
            f"{day.protein_g_total:.1f} | {day.fat_g_total:.1f} | {day.carbs_g_total:.1f} |"
        )
    sections.append(
        f"| **Среднее** | — | **{avg_kcal:.0f}** | "
        f"**{sum(d.protein_g_total for d in resolved.days)/7:.1f}** | "
        f"**{sum(d.fat_g_total for d in resolved.days)/7:.1f}** | "
        f"**{sum(d.carbs_g_total for d in resolved.days)/7:.1f}** |"
    )
    sections.append(
        f"| **Цель** | — | **{targets['kcal_per_day']:.0f}** | "
        f"**{targets['protein_g_per_day']:.0f}** | "
        f"**{targets['fat_g_per_day']:.0f}** | "
        f"**{targets['carbs_g_per_day']:.0f}** |"
    )

    if resolved.unresolved_refs:
        sections.append("\n---\n")
        sections.append("# ⚠️ Нерезолвенные ссылки")
        sections.append("")
        for ref in resolved.unresolved_refs:
            sections.append(f"- `{ref}`")

    return "\n".join(sections)


def render_to_file(plan_path: Path, output_path: Path) -> None:
    """Render a week plan JSON to markdown file."""
    from .resolver import Resolver, load_week_plan
    plan = load_week_plan(plan_path)
    resolver = Resolver()
    resolved = resolver.resolve_week(plan)
    output_path.write_text(render_week(plan, resolved), encoding="utf-8")
    print(f"✓ Rendered → {output_path}")
