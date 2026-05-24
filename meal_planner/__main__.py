"""
CLI entry point.

Usage:
  python -m meal_planner render <plan.json> [-o output.md]
  python -m meal_planner shopping <plan.json> [-o output.csv]
  python -m meal_planner validate <plan.json> [-o report.md]
  python -m meal_planner report <plan.json>
  python -m meal_planner order-match <plan.json>
  python -m meal_planner create [-o new_plan.json]
  python -m meal_planner edit <plan.json> [subcommand...]
  python -m meal_planner html <plan.json> [-o output.html]
  python -m meal_planner all <plan.json>     # run render+shopping+validate+report

All output goes under output/ by default unless -o is specified.
"""

from __future__ import annotations
import sys
from pathlib import Path

import click

from .config import OUTPUT_DIR as DEFAULT_OUTPUT


@click.group()
def cli():
    """Meal planner CLI."""
    DEFAULT_OUTPUT.mkdir(exist_ok=True)


@cli.command()
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
@click.option("-o", "--output", type=click.Path(path_type=Path), default=None)
def render(plan_path: Path, output: Path | None):
    """Render plan JSON → markdown."""
    from .render_md import render_to_file
    output = output or DEFAULT_OUTPUT / "weekly_plan.md"
    render_to_file(plan_path, output)


@cli.command()
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
@click.option("-o", "--output", type=click.Path(path_type=Path), default=None)
def shopping(plan_path: Path, output: Path | None):
    """Generate shopping list CSV from plan."""
    from .shopping import generate_shopping
    output = output or DEFAULT_OUTPUT / "shopping_list.csv"
    generate_shopping(plan_path, output)


@cli.command()
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
@click.option("-o", "--output", type=click.Path(path_type=Path), default=None)
def validate(plan_path: Path, output: Path | None):
    """Validate plan against rules."""
    from .validate import validate_plan
    output = output or DEFAULT_OUTPUT / "validation_report.md"
    validate_plan(plan_path, output)


@cli.command()
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
def report(plan_path: Path):
    """Print rich report to terminal."""
    from .report import print_report
    print_report(plan_path)


@cli.command("order-match")
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
def order_match(plan_path: Path):
    """Match planned shopping list against actual orders."""
    from .order_match import print_match_report
    print_match_report(plan_path)


@cli.command()
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
@click.option("-o", "--output", type=click.Path(path_type=Path), default=None)
def html(plan_path: Path, output: Path | None):
    """Generate static HTML viewer."""
    from .html_viewer import generate_html
    output = output or DEFAULT_OUTPUT / "weekly_plan.html"
    generate_html(plan_path, output)


@cli.command()
@click.option("-o", "--output", type=click.Path(path_type=Path), default=None)
@click.option("--week-id", default=None, help="e.g., 2026-W22")
def create(output: Path | None, week_id: str | None):
    """Interactive: create a new week plan."""
    from .create import interactive_create
    interactive_create(output, week_id)


@cli.command()
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
def edit(plan_path: Path):
    """Interactive: edit an existing week plan."""
    from .edit import interactive_edit
    interactive_edit(plan_path)


@cli.command("all")
@click.argument("plan_path", type=click.Path(exists=True, path_type=Path))
def all_cmd(plan_path: Path):
    """Run render + shopping + validate + html + report."""
    from .render_md import render_to_file
    from .shopping import generate_shopping
    from .validate import validate_plan
    from .html_viewer import generate_html
    from .report import print_report

    render_to_file(plan_path, DEFAULT_OUTPUT / "weekly_plan.md")
    generate_shopping(plan_path, DEFAULT_OUTPUT / "shopping_list.csv")
    validate_plan(plan_path, DEFAULT_OUTPUT / "validation_report.md")
    generate_html(plan_path, DEFAULT_OUTPUT / "weekly_plan.html")
    print()
    print_report(plan_path)


if __name__ == "__main__":
    cli()
