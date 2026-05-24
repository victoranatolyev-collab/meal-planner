"""
Interactive plan editor.

Supports atomic operations:
- swap-meal: replace one dish in a meal with another
- change-portion: change portion multiplier for a dish in a meal
- add-tail: add a sweet tail to a meal
- remove-item: remove an item from a meal
- view: show current day/meal details
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Optional

import questionary
from rich.console import Console

from .schema import WeekPlan, Meal, MealItem
from .resolver import load_dishes_library, load_week_plan, Resolver


console = Console()


def _save_plan(plan: WeekPlan, path: Path) -> None:
    """Save plan back to JSON."""
    with path.open("w", encoding="utf-8") as f:
        json.dump(plan.model_dump(exclude_none=False), f, ensure_ascii=False, indent=2)


def interactive_edit(plan_path: Path) -> None:
    """Run interactive edit loop."""
    library = load_dishes_library()
    available_dishes = list(library.dishes.keys())

    console.rule(f"[bold magenta]Edit: {plan_path.name}[/]")

    while True:
        plan = load_week_plan(plan_path)
        action = questionary.select(
            "Что сделать?",
            choices=[
                "📊 Показать сводку",
                "🔄 Заменить блюдо в приёме",
                "📏 Изменить порцию",
                "🍬 Добавить хвост",
                "❌ Удалить позицию",
                "💾 Выход (всё уже сохранено)",
            ],
        ).ask()

        if action.startswith("💾") or action is None:
            break
        elif action.startswith("📊"):
            _show_summary(plan)
        elif action.startswith("🔄"):
            _swap_meal(plan, plan_path, available_dishes)
        elif action.startswith("📏"):
            _change_portion(plan, plan_path)
        elif action.startswith("🍬"):
            _add_tail(plan, plan_path, available_dishes)
        elif action.startswith("❌"):
            _remove_item(plan, plan_path)


def _show_summary(plan: WeekPlan) -> None:
    """Quick summary with totals."""
    resolver = Resolver()
    resolved = resolver.resolve_week(plan)
    avg = resolved.kcal_total / 7
    console.print(f"  Среднее {avg:.0f} ккал/день (цель {plan.nutrition_targets.kcal_per_day:.0f})")
    console.print(f"  Дней: {len(plan.schedule)}, приёмов: {sum(len(d.meals) for d in plan.schedule)}")
    for d in resolved.days:
        console.print(f"    {d.day} ({d.day_type}): {d.kcal_total:.0f}К / {d.protein_g_total:.1f}Б")


def _pick_meal(plan: WeekPlan) -> Optional[tuple[int, int]]:
    """Let user pick a (day_idx, meal_idx)."""
    day_choices = [
        questionary.Choice(f"{d.day} ({d.day_type}, {len(d.meals)} приёмов)", value=i)
        for i, d in enumerate(plan.schedule)
    ]
    day_idx = questionary.select("День?", choices=day_choices).ask()
    if day_idx is None:
        return None
    day = plan.schedule[day_idx]
    meal_choices = [
        questionary.Choice(f"{m.time} {m.name} ({len(m.items)} поз.)", value=i)
        for i, m in enumerate(day.meals)
    ]
    meal_idx = questionary.select("Приём?", choices=meal_choices).ask()
    if meal_idx is None:
        return None
    return (day_idx, meal_idx)


def _swap_meal(plan: WeekPlan, path: Path, available_dishes: list[str]) -> None:
    """Replace a dish in a meal with another."""
    picked = _pick_meal(plan)
    if picked is None:
        return
    day_idx, meal_idx = picked
    meal = plan.schedule[day_idx].meals[meal_idx]
    if not meal.items:
        console.print("[yellow]Приём пустой, нечего заменить[/]")
        return
    item_choices = [
        questionary.Choice(f"{it.dish_id or it.label or '—'}", value=i)
        for i, it in enumerate(meal.items)
    ]
    item_idx = questionary.select("Какую позицию заменить?", choices=item_choices).ask()
    if item_idx is None:
        return
    new_dish = questionary.autocomplete(
        "На какое блюдо? (id из dishes_library)",
        choices=available_dishes,
    ).ask()
    if not new_dish or new_dish not in available_dishes:
        console.print(f"[red]'{new_dish}' не в библиотеке[/]")
        return
    meal.items[item_idx].dish_id = new_dish
    _save_plan(plan, path)
    console.print(f"[green]✓ {meal.items[item_idx].dish_id} → {new_dish}[/]")


def _change_portion(plan: WeekPlan, path: Path) -> None:
    """Change portion multiplier."""
    picked = _pick_meal(plan)
    if picked is None:
        return
    day_idx, meal_idx = picked
    meal = plan.schedule[day_idx].meals[meal_idx]
    if not meal.items:
        return
    item_choices = [
        questionary.Choice(f"{it.dish_id or '—'} (×{it.portion})", value=i)
        for i, it in enumerate(meal.items)
    ]
    item_idx = questionary.select("Какую позицию?", choices=item_choices).ask()
    if item_idx is None:
        return
    new_portion = float(questionary.text(f"Новый портион (текущий {meal.items[item_idx].portion}):").ask())
    meal.items[item_idx].portion = new_portion
    _save_plan(plan, path)
    console.print(f"[green]✓ Порция → ×{new_portion}[/]")


def _add_tail(plan: WeekPlan, path: Path, available_dishes: list[str]) -> None:
    """Add a sweet tail to a meal."""
    picked = _pick_meal(plan)
    if picked is None:
        return
    day_idx, meal_idx = picked
    new_dish = questionary.autocomplete(
        "Какой хвост? (id блюда из библиотеки)",
        choices=[d for d in available_dishes if "chocolate" in d or "snickers" in d or "twix" in d or "marmalade" in d or "milky" in d or "syrok" in d],
    ).ask()
    if not new_dish or new_dish not in available_dishes:
        return
    from_stock = questionary.confirm("Из домашних запасов?", default=False).ask()
    plan.schedule[day_idx].meals[meal_idx].items.append(
        MealItem(dish_id=new_dish, tail=True, from_stock=from_stock)
    )
    _save_plan(plan, path)
    console.print(f"[green]✓ Добавлен хвост: {new_dish}[/]")


def _remove_item(plan: WeekPlan, path: Path) -> None:
    """Remove an item from a meal."""
    picked = _pick_meal(plan)
    if picked is None:
        return
    day_idx, meal_idx = picked
    meal = plan.schedule[day_idx].meals[meal_idx]
    if not meal.items:
        return
    item_choices = [
        questionary.Choice(f"{it.dish_id or '—'}", value=i)
        for i, it in enumerate(meal.items)
    ]
    item_idx = questionary.select("Какую позицию удалить?", choices=item_choices).ask()
    if item_idx is None:
        return
    removed = meal.items.pop(item_idx)
    _save_plan(plan, path)
    console.print(f"[green]✓ Удалена позиция: {removed.dish_id}[/]")
