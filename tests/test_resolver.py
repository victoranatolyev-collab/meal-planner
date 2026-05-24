"""Resolver tests."""
import pytest


def test_resolver_resolves_all_refs(resolved_week):
    assert resolved_week.unresolved_refs == [], f"Unresolved: {resolved_week.unresolved_refs}"


def test_resolver_has_all_days(resolved_week):
    days = [d.day for d in resolved_week.days]
    assert days == ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def test_kbju_calculations(resolved_week):
    targets = resolved_week.targets
    for day in resolved_week.days:
        # daily kcal should be within 30% of target
        assert 0.7 * targets["kcal_per_day"] <= day.kcal_total <= 1.3 * targets["kcal_per_day"], \
            f"Day {day.day} kcal {day.kcal_total} out of range"


def test_cumulative_kcal_increases(resolved_week):
    for day in resolved_week.days:
        prev_cum = 0
        for meal in day.meals:
            assert meal.cumulative_kcal >= prev_cum
            prev_cum = meal.cumulative_kcal


def test_iron_meal_tag_exists(resolved_week):
    sunday = next(d for d in resolved_week.days if d.day == "Вс")
    iron_meals = [m for m in sunday.meals if "iron_meal" in m.tags]
    assert len(iron_meals) == 2, "Should be 2 iron meals on Вс"


def test_main_a_appears_multiple_days(resolved_week):
    days_with_main_a = 0
    for day in resolved_week.days:
        for meal in day.meals:
            for item in meal.items:
                if item.dish_id == "main_a":
                    days_with_main_a += 1
                    break
            else:
                continue
            break
    assert days_with_main_a >= 4, "Курица ≥4 дня"
