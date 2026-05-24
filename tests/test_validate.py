"""Validator tests."""
import pytest

from meal_planner.validate import Validator, ValidationIssue
from meal_planner.shopping import compute_shopping_items, summarize_by_shop


def test_validator_runs(loaded_plan, resolver, resolved_week):
    items = compute_shopping_items(resolved_week, loaded_plan, resolver)
    summary = summarize_by_shop(items)
    issues = Validator().validate(resolved_week, loaded_plan, summary)
    assert isinstance(issues, list)


def test_iron_dairy_detected(loaded_plan, resolver, resolved_week):
    """Main C contains йогурт Teos (20г) — should flag in iron meal."""
    issues = Validator().validate(resolved_week, loaded_plan)
    iron_issues = [i for i in issues if i.rule == "iron_meal_no_dairy"]
    assert len(iron_issues) >= 1, "Должно поймать йогурт в Main C на Вс"


def test_protein_deficit_detected(loaded_plan, resolver, resolved_week):
    """Plan currently gives ~95г белка vs target 161 — should warn."""
    issues = Validator().validate(resolved_week, loaded_plan)
    protein_issues = [i for i in issues if i.rule.startswith("kbju_") and "protein" in i.rule]
    assert len(protein_issues) >= 1


def test_chicken_4days_detected(loaded_plan, resolver, resolved_week):
    """Курица должна быть ≥4 дней — план соответствует."""
    issues = Validator().validate(resolved_week, loaded_plan)
    chicken_issues = [i for i in issues if i.rule == "protein_chicken_4days"]
    assert len(chicken_issues) == 0, "Курица должна быть в ≥4 днях (Пн+Вт+Ср+Чт+шаурмы)"


def test_liver_required(loaded_plan, resolver, resolved_week):
    """Печень должна быть 1×/неделю."""
    issues = Validator().validate(resolved_week, loaded_plan)
    liver_issues = [i for i in issues if i.rule == "protein_liver_weekly"]
    assert len(liver_issues) == 0, "Печень есть в Вс"
