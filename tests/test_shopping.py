"""Shopping list generator tests."""
import pytest

from meal_planner.shopping import compute_shopping_items, summarize_by_shop


def test_shopping_items_generated(loaded_plan, resolver, resolved_week):
    items = compute_shopping_items(resolved_week, loaded_plan, resolver)
    assert len(items) > 10


def test_stock_items_excluded_or_marked(loaded_plan, resolver, resolved_week):
    items = compute_shopping_items(resolved_week, loaded_plan, resolver)
    # Items that are 100% from stock should not appear
    refs = {item.ref for item in items}
    # mw_mini is in stock and used only from_stock — should NOT be in shopping
    assert "local:mw_mini" not in refs


def test_summary_by_shop(loaded_plan, resolver, resolved_week):
    items = compute_shopping_items(resolved_week, loaded_plan, resolver)
    summary = summarize_by_shop(items)
    assert "Пятёрочка" in summary
    assert "Цех 85" in summary
    assert "ЛЛ" in summary


def test_pyat_count_around_30(loaded_plan, resolver, resolved_week):
    items = compute_shopping_items(resolved_week, loaded_plan, resolver)
    pyat = [i for i in items if i.shop == "Пятёрочка"]
    # Around 25-35 items in Пятёрочка
    assert 20 <= len(pyat) <= 40
