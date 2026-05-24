"""
Path configuration for meal_planner.

Centralized so paths can be overridden via env vars for portability.

By default resolves to:
- APP_ROOT/data/   — catalogs (ingredients_spb.json, dishes_library.json, ...)
- APP_ROOT/plans/  — week_*.json plan files
- APP_ROOT/output/ — generated artifacts (md, csv, html)

Where APP_ROOT is the parent of this `meal_planner/` package directory,
or override via MEAL_PLANNER_ROOT env var.
"""

from __future__ import annotations
import os
from pathlib import Path


# Allow override via env var
_env_root = os.environ.get("MEAL_PLANNER_ROOT")
APP_ROOT: Path = Path(_env_root).resolve() if _env_root else Path(__file__).resolve().parent.parent

DATA_DIR: Path = APP_ROOT / "data"
PLANS_DIR: Path = APP_ROOT / "plans"
OUTPUT_DIR: Path = APP_ROOT / "output"


def info() -> dict:
    """Return resolved paths (useful for debugging)."""
    return {
        "APP_ROOT": str(APP_ROOT),
        "DATA_DIR": str(DATA_DIR),
        "PLANS_DIR": str(PLANS_DIR),
        "OUTPUT_DIR": str(OUTPUT_DIR),
        "ingredients_spb_exists": (DATA_DIR / "ingredients_spb.json").exists(),
        "dishes_library_exists": (DATA_DIR / "dishes_library.json").exists(),
        "custom_ingredients_exists": (DATA_DIR / "custom_ingredients.json").exists(),
    }
