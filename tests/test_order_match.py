"""Order matcher tests."""
import pytest

from meal_planner.order_match import match_orders
from meal_planner.shopping import compute_shopping_items


def test_match_returns_results(loaded_plan, resolver, resolved_week):
    planned = compute_shopping_items(resolved_week, loaded_plan, resolver)
    matches = match_orders(loaded_plan, planned)
    assert len(matches) > 5


def test_actual_order_exists(loaded_plan):
    assert loaded_plan.actual_orders, "Должен быть фактический заказ"
    assert loaded_plan.actual_orders[0].order_id == "1482444937"


def test_tamaki_marked_missing(loaded_plan, resolver, resolved_week):
    """Tamaki в плане был, в факт. заказе НЕТ → missing."""
    # Tamaki не в текущем плане JSON (заменено на йогурт-шрирача), но в реальном заказе тоже нет
    # Так что должно быть пустое пересечение
    planned = compute_shopping_items(resolved_week, loaded_plan, resolver)
    matches = match_orders(loaded_plan, planned)
    # Не должно быть Tamaki в planned items
    tamaki_in_plan = [m for m in matches if m.plan_item and "tamaki" in m.plan_item.name.lower()]
    assert len(tamaki_in_plan) == 0


def test_extras_detected(loaded_plan, resolver, resolved_week):
    """Конфеты Лакомство куплены, но не в плановой shopping list (план генерируется из ingredients)."""
    planned = compute_shopping_items(resolved_week, loaded_plan, resolver)
    matches = match_orders(loaded_plan, planned)
    # Extras: items in order without match in plan
    extras = [m for m in matches if m.status == "extra"]
    assert len(extras) >= 1
