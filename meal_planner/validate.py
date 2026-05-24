"""
Plan validator: checks rules from menu_rules.md.

Rules:
- KBJU per day within ±10% of target (warning) or ±20% (error)
- Budget Пятёрочка ≤ target (warning if exceeded)
- Iron rule: Вс печень — no coffee/tea 11-15, no dairy in iron meals
- C1: sweet breakfast (Цех 85 sweet) has no sweet tail
- Chicken ≥4 days/week
- Liver 1×/week
- Fish 1×/week
- ЛЛ ≤3×/week
- Spring shawarma frozen, Sat/Sun home meals fresh
- Sat ужин не main_b если нет рыбы; etc.

Outputs: list of (severity, message) tuples.
"""

from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from .resolver import ResolvedWeek, ResolvedDay, ResolvedMeal, Resolver, load_week_plan
from .schema import WeekPlan
from .shopping import compute_shopping_items, summarize_by_shop


Severity = Literal["error", "warning", "info"]


@dataclass
class ValidationIssue:
    severity: Severity
    rule: str
    message: str
    location: str = ""  # e.g., "day=Вс meal=Обед"


class Validator:
    """Validates a resolved week plan against rules."""

    def __init__(self, kcal_tolerance_warning: float = 0.10, kcal_tolerance_error: float = 0.20):
        self.kcal_warn = kcal_tolerance_warning
        self.kcal_err = kcal_tolerance_error

    def validate(self, resolved: ResolvedWeek, plan: WeekPlan, shopping_summary: dict | None = None) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        issues.extend(self._validate_kbju(resolved))
        issues.extend(self._validate_iron_rule(resolved))
        issues.extend(self._validate_c1_sweet_breakfast(resolved))
        issues.extend(self._validate_protein_sources(resolved))
        issues.extend(self._validate_ll_count(resolved))
        issues.extend(self._validate_no_iron_dairy(resolved))
        issues.extend(self._validate_unresolved(resolved))
        if shopping_summary:
            issues.extend(self._validate_budget(resolved, plan, shopping_summary))
        return issues

    def _validate_kbju(self, resolved: ResolvedWeek) -> list[ValidationIssue]:
        issues = []
        target_kcal = resolved.targets["kcal_per_day"]
        target_protein = resolved.targets["protein_g_per_day"]

        for day in resolved.days:
            diff_pct = (day.kcal_total - target_kcal) / target_kcal
            if abs(diff_pct) > self.kcal_err:
                issues.append(ValidationIssue(
                    severity="error",
                    rule="kbju_daily_kcal",
                    message=f"День {day.day}: {day.kcal_total:.0f} ккал ({diff_pct*100:+.1f}% от цели {target_kcal:.0f}) — превышен порог ±{self.kcal_err*100:.0f}%",
                    location=f"day={day.day}",
                ))
            elif abs(diff_pct) > self.kcal_warn:
                issues.append(ValidationIssue(
                    severity="warning",
                    rule="kbju_daily_kcal",
                    message=f"День {day.day}: {day.kcal_total:.0f} ккал ({diff_pct*100:+.1f}% от цели {target_kcal:.0f})",
                    location=f"day={day.day}",
                ))

            # Protein per day
            if day.protein_g_total < target_protein * 0.7:
                issues.append(ValidationIssue(
                    severity="warning",
                    rule="kbju_daily_protein",
                    message=f"День {day.day}: белок {day.protein_g_total:.1f}г (<70% от цели {target_protein:.0f}г)",
                    location=f"day={day.day}",
                ))

        # Weekly average protein
        avg_protein = sum(d.protein_g_total for d in resolved.days) / 7
        if avg_protein < target_protein * 0.8:
            issues.append(ValidationIssue(
                severity="warning",
                rule="kbju_weekly_protein_avg",
                message=f"Среднее белок {avg_protein:.1f}г/день (<80% от цели {target_protein:.0f}г). Дефицит {target_protein - avg_protein:.1f}г/день.",
            ))

        return issues

    def _validate_iron_rule(self, resolved: ResolvedWeek) -> list[ValidationIssue]:
        """Iron meals (печень Вс) — no coffee/tea ±1-2h, no dairy."""
        issues = []
        for day in resolved.days:
            iron_meals = [m for m in day.meals if "iron_meal" in m.tags]
            if not iron_meals:
                continue

            iron_times = [self._parse_time(m.time) for m in iron_meals]
            # Check no coffee/tea in iron window
            for meal in day.meals:
                meal_time = self._parse_time(meal.time)
                if meal_time is None:
                    continue
                for iron_time in iron_times:
                    if iron_time is None:
                        continue
                    diff_hours = abs((meal_time - iron_time).total_seconds() / 3600)
                    if 0 < diff_hours <= 2:  # within 2h of iron meal
                        for item in meal.items:
                            name_lower = (item.dish_name or "").lower()
                            if "кофе" in name_lower or "чай" in name_lower:
                                # Check if it's before (1h) or after (2h)
                                is_before = meal_time < iron_time
                                window_h = 1 if is_before else 2
                                if diff_hours <= window_h:
                                    issues.append(ValidationIssue(
                                        severity="error",
                                        rule="iron_rule_no_coffee",
                                        message=f"День {day.day}: кофе/чай в {meal.time} нарушает правило железа (±{window_h}ч от {iron_meals[0].time})",
                                        location=f"day={day.day} meal={meal.name}",
                                    ))
        return issues

    def _validate_no_iron_dairy(self, resolved: ResolvedWeek) -> list[ValidationIssue]:
        """Iron meals don't contain dairy (chocolate with milk, yogurt, milk, cheese, curd)."""
        DAIRY_KEYWORDS = ["молочн", "йогурт", "молоко", "сыр", "творог", "конфет"]
        issues = []
        for day in resolved.days:
            for meal in day.meals:
                if "iron_meal" not in meal.tags and "no_dairy" not in meal.tags:
                    continue
                for item in meal.items:
                    for ing in item.ingredients:
                        name_lower = ing.name.lower()
                        if any(kw in name_lower for kw in DAIRY_KEYWORDS):
                            issues.append(ValidationIssue(
                                severity="error",
                                rule="iron_meal_no_dairy",
                                message=f"День {day.day} {meal.name}: содержит молочку '{ing.name}' в железном приёме",
                                location=f"day={day.day} meal={meal.name}",
                            ))
        return issues

    def _validate_c1_sweet_breakfast(self, resolved: ResolvedWeek) -> list[ValidationIssue]:
        """C1: sweet breakfast (≥25g sugar / sweet_breakfast tag) doesn't have a sweet tail."""
        issues = []
        for day in resolved.days:
            for meal in day.meals:
                is_sweet = "sweet_breakfast" in meal.tags
                if not is_sweet:
                    # Check carbs as proxy (>50g and breakfast time)
                    if meal.carbs_g >= 50 and self._parse_time(meal.time) and self._parse_time(meal.time).hour < 11:
                        # heuristic: sweet breakfast
                        pass  # don't auto-trigger, rely on tags
                if is_sweet:
                    has_tail = any(item.is_tail for item in meal.items)
                    if has_tail and "c1_exclusion" not in meal.tags:
                        issues.append(ValidationIssue(
                            severity="warning",
                            rule="c1_sweet_breakfast",
                            message=f"День {day.day}: сладкий завтрак с хвостом — нарушение C1 (или добавь тег c1_exclusion)",
                            location=f"day={day.day} meal={meal.name}",
                        ))
        return issues

    def _validate_protein_sources(self, resolved: ResolvedWeek) -> list[ValidationIssue]:
        """Курица ≥4 дня, печень 1×, рыба 1×."""
        issues = []
        days_with_chicken = 0
        days_with_liver = 0
        days_with_fish = 0
        beef_count = 0

        for day in resolved.days:
            has_chicken = False
            has_liver = False
            has_fish = False
            for meal in day.meals:
                for item in meal.items:
                    name = (item.dish_name or "").lower()
                    ing_names = " ".join(i.name.lower() for i in item.ingredients)
                    if "куриц" in name or "куриц" in ing_names or "грудк" in ing_names:
                        has_chicken = True
                    if "печен" in name or "печен" in ing_names:
                        has_liver = True
                    if "скумбри" in name or "скумбри" in ing_names or "рыб" in ing_names:
                        has_fish = True
                    if "салями" in ing_names or "чипотле" in name.lower():
                        beef_count += 1
            if has_chicken:
                days_with_chicken += 1
            if has_liver:
                days_with_liver += 1
            if has_fish:
                days_with_fish += 1

        if days_with_chicken < 4:
            issues.append(ValidationIssue(
                severity="warning",
                rule="protein_chicken_4days",
                message=f"Курица только в {days_with_chicken} дней (план ≥4)",
            ))
        if days_with_liver < 1:
            issues.append(ValidationIssue(
                severity="error",
                rule="protein_liver_weekly",
                message=f"Печень 0 раз/нед (план 1× для железа — Hb 110)",
            ))
        if days_with_fish < 1:
            issues.append(ValidationIssue(
                severity="warning",
                rule="protein_fish_weekly",
                message=f"Рыба 0 раз/нед (план 1× для омега-3)",
            ))
        return issues

    def _validate_ll_count(self, resolved: ResolvedWeek) -> list[ValidationIssue]:
        """ЛЛ десерты ≤3 раз/неделю."""
        ll_count = 0
        for day in resolved.days:
            for meal in day.meals:
                for item in meal.items:
                    name = (item.dish_name or "").lower()
                    if "ds-" in name.lower() or "ЛЛ" in (item.dish_name or ""):
                        ll_count += 1
        if ll_count > 3:
            return [ValidationIssue(
                severity="warning",
                rule="ll_count_3max",
                message=f"ЛЛ десертов: {ll_count} (план ≤3)",
            )]
        return []

    def _validate_unresolved(self, resolved: ResolvedWeek) -> list[ValidationIssue]:
        return [
            ValidationIssue(
                severity="error",
                rule="unresolved_ref",
                message=f"Не найдено в каталоге: {ref}",
            )
            for ref in resolved.unresolved_refs
        ]

    def _validate_budget(self, resolved: ResolvedWeek, plan: WeekPlan, summary: dict) -> list[ValidationIssue]:
        total = sum(s["total_rub"] for s in summary.values())
        target = plan.budget.target_rub_per_week
        if total > target:
            severity: Severity = "error" if (plan.budget.soft_cap_rub and total > plan.budget.soft_cap_rub) else "warning"
            return [ValidationIssue(
                severity=severity,
                rule="budget",
                message=f"Бюджет {total:.0f}₽ > цель {target:.0f}₽ (+{total-target:.0f}₽)",
            )]
        return []

    @staticmethod
    def _parse_time(time_str: str):
        from datetime import datetime
        try:
            return datetime.strptime(time_str, "%H:%M")
        except (ValueError, TypeError):
            return None


def format_issues(issues: list[ValidationIssue]) -> str:
    """Format issues as text report."""
    by_severity = {"error": [], "warning": [], "info": []}
    for issue in issues:
        by_severity[issue.severity].append(issue)

    lines = []
    lines.append(f"# Validation Report")
    lines.append("")
    lines.append(f"- 🔴 Errors:   {len(by_severity['error'])}")
    lines.append(f"- 🟡 Warnings: {len(by_severity['warning'])}")
    lines.append(f"- ℹ️ Info:     {len(by_severity['info'])}")
    lines.append("")

    for sev, label in [("error", "## 🔴 Errors"), ("warning", "## 🟡 Warnings"), ("info", "## ℹ️ Info")]:
        if not by_severity[sev]:
            continue
        lines.append(label)
        lines.append("")
        for issue in by_severity[sev]:
            loc = f" *({issue.location})*" if issue.location else ""
            lines.append(f"- **[{issue.rule}]** {issue.message}{loc}")
        lines.append("")

    return "\n".join(lines)


def validate_plan(plan_path: Path, output_path: Path | None = None) -> list[ValidationIssue]:
    """End-to-end: load plan → validate → write report."""
    plan = load_week_plan(plan_path)
    resolver = Resolver()
    resolved = resolver.resolve_week(plan)
    items = compute_shopping_items(resolved, plan, resolver)
    summary = summarize_by_shop(items)
    validator = Validator()
    issues = validator.validate(resolved, plan, summary)
    report = format_issues(issues)
    if output_path:
        output_path.write_text(report, encoding="utf-8")
        print(f"✓ Validation report → {output_path}")
    print(report)
    return issues
