"""Pytest configuration: app/ as importable package root."""
import sys
from pathlib import Path

APP_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(APP_ROOT))


import pytest


@pytest.fixture
def project_root() -> Path:
    return APP_ROOT


@pytest.fixture
def plan_path(project_root: Path) -> Path:
    return project_root / "plans" / "week_2026-W21.json"


@pytest.fixture
def loaded_plan(plan_path):
    from meal_planner.resolver import load_week_plan
    return load_week_plan(plan_path)


@pytest.fixture
def resolver():
    from meal_planner.resolver import Resolver
    return Resolver()


@pytest.fixture
def resolved_week(loaded_plan, resolver):
    return resolver.resolve_week(loaded_plan)
