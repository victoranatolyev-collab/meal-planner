"""
Static HTML viewer for week plans.

Generates a single self-contained HTML file with:
- Daily schedule tables
- KBJU summary chart (CSS-only bar chart)
- Shopping list with filters
- Iron-meal validation
- Actual order comparison
"""

from __future__ import annotations
import json
from pathlib import Path

from .resolver import Resolver, load_week_plan, ResolvedWeek
from .schema import WeekPlan
from .shopping import compute_shopping_items, summarize_by_shop, ShoppingItem
from .validate import Validator, ValidationIssue


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Meal Plan {week_id}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; background: #f5f5f7; color: #1d1d1f; line-height: 1.5; }}
  .container {{ max-width: 1200px; margin: 0 auto; }}
  h1 {{ font-size: 32px; margin: 0 0 8px; }}
  h2 {{ font-size: 22px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e0e0e2; }}
  h3 {{ font-size: 18px; margin: 20px 0 8px; color: #0066cc; }}
  .header-meta {{ color: #6e6e73; margin-bottom: 24px; }}
  .stat-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0; }}
  .stat {{ background: white; padding: 12px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }}
  .stat-label {{ font-size: 12px; color: #6e6e73; text-transform: uppercase; letter-spacing: 0.5px; }}
  .stat-value {{ font-size: 22px; font-weight: 600; margin-top: 4px; }}
  .stat-value.good {{ color: #2d8f4a; }}
  .stat-value.warn {{ color: #b87600; }}
  .stat-value.bad {{ color: #c4392b; }}
  table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 16px; }}
  th, td {{ padding: 10px 14px; text-align: left; border-bottom: 1px solid #f0f0f3; font-size: 14px; vertical-align: top; }}
  th {{ background: #fafafa; font-weight: 600; font-size: 13px; color: #6e6e73; text-transform: uppercase; letter-spacing: 0.3px; }}
  tr:last-child td {{ border-bottom: 0; }}
  .day-header {{ display: flex; justify-content: space-between; align-items: baseline; margin: 24px 0 8px; }}
  .day-title {{ font-size: 20px; font-weight: 600; }}
  .day-sum {{ color: #6e6e73; font-size: 14px; }}
  .tail-mark {{ color: #d97706; font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #fef3c7; margin-left: 6px; }}
  .stock-mark {{ color: #6b7280; font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #e5e7eb; margin-left: 6px; }}
  .tag {{ display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #dbeafe; color: #1e40af; margin-right: 4px; }}
  .tag.warn {{ background: #fed7aa; color: #9a3412; }}
  .filter-bar {{ display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }}
  .filter-bar button {{ padding: 6px 12px; border: 1px solid #d2d2d7; background: white; border-radius: 8px; cursor: pointer; font-size: 13px; }}
  .filter-bar button.active {{ background: #0066cc; color: white; border-color: #0066cc; }}
  .bar-chart {{ display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }}
  .bar-row {{ display: grid; grid-template-columns: 60px 1fr 80px; align-items: center; gap: 8px; font-size: 13px; }}
  .bar-bg {{ background: #f0f0f3; border-radius: 6px; height: 22px; position: relative; overflow: hidden; }}
  .bar-fg {{ background: linear-gradient(90deg, #34d399, #10b981); height: 100%; border-radius: 6px; transition: width 0.3s; }}
  .bar-target {{ position: absolute; top: 0; bottom: 0; width: 2px; background: #c4392b; }}
  .note {{ background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; margin: 12px 0; font-size: 14px; }}
  .note.error {{ background: #fef2f2; border-left-color: #dc2626; }}
  .note.info {{ background: #eff6ff; border-left-color: #2563eb; }}
  .pill {{ display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 12px; background: #e5e7eb; margin-left: 4px; }}
  .pill.green {{ background: #d1fae5; color: #065f46; }}
  .pill.red {{ background: #fee2e2; color: #991b1b; }}
  .pill.yellow {{ background: #fef3c7; color: #92400e; }}
  details {{ background: white; border-radius: 8px; padding: 8px 14px; margin-bottom: 8px; }}
  summary {{ cursor: pointer; font-weight: 600; padding: 6px 0; }}
  .ingredient-list {{ font-size: 12px; color: #6e6e73; }}
  ul {{ list-style: disc; }}
  ul li {{ font-size: 12.5px; color: #4b5563; margin: 2px 0; }}
  ul li em {{ color: #6b7280; font-style: normal; }}
  .delta.pos {{ color: #c4392b; }}
  .delta.neg {{ color: #2d8f4a; }}
</style>
</head>
<body>
<div class="container">
  <h1>🍽 Недельный план — {week_id}</h1>
  <div class="header-meta">
    {start_date} → {end_date} · Норма: {target_kcal:.0f} ккал / {target_protein:.0f}Б / {target_fat:.0f}Ж / {target_carbs:.0f}У
  </div>

  <h2>📊 КБЖУ сводка</h2>
  <div class="stat-grid">
    <div class="stat"><div class="stat-label">Среднее ккал/день</div><div class="stat-value {kcal_color}">{avg_kcal:.0f}</div></div>
    <div class="stat"><div class="stat-label">Среднее белок</div><div class="stat-value {protein_color}">{avg_protein:.1f}г</div></div>
    <div class="stat"><div class="stat-label">Среднее жир</div><div class="stat-value">{avg_fat:.1f}г</div></div>
    <div class="stat"><div class="stat-label">Среднее углеводы</div><div class="stat-value">{avg_carbs:.1f}г</div></div>
    <div class="stat"><div class="stat-label">Бюджет</div><div class="stat-value {budget_color}">{budget_total:.0f}₽</div></div>
  </div>

  <h3>КБЖУ по дням (ккал)</h3>
  <div class="bar-chart">
    {kcal_bars}
  </div>

  <h2>📅 Расписание</h2>
  {schedule_html}

  <h2>🛒 Список покупок</h2>
  <div class="filter-bar">
    <button class="active" onclick="filterShop('all', this)">Все ({total_items})</button>
    {shop_filters}
  </div>
  <table id="shopping-table">
    <thead><tr><th>Магазин</th><th>PLU/Код</th><th>Товар</th><th>Кол-во</th><th>Цена ₽</th></tr></thead>
    <tbody>
      {shopping_rows}
    </tbody>
  </table>

  {actual_orders_html}

  <h2>✅ Валидация</h2>
  {validation_html}

  <h2>⚙ Метаданные</h2>
  <p style="font-size: 13px; color: #6e6e73;">
    Сгенерировано: {generated_at}<br>
    Источник: <code>{plan_path}</code><br>
    Каталог цен: <code>data/ingredients_spb.json</code> ({catalog_count} PLU)<br>
    Кастомные ингредиенты: <code>data/custom_ingredients.json</code><br>
    Библиотека блюд: <code>data/dishes_library.json</code>
  </p>
</div>

<script>
function filterShop(shop, btn) {{
  document.querySelectorAll('.filter-bar button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#shopping-table tbody tr').forEach(row => {{
    if (shop === 'all' || row.dataset.shop === shop) {{
      row.style.display = '';
    }} else {{
      row.style.display = 'none';
    }}
  }});
}}
</script>
</body>
</html>"""


def _render_kcal_bars(resolved: ResolvedWeek) -> str:
    """CSS bar chart for daily kcal."""
    target = resolved.targets["kcal_per_day"]
    max_kcal = max(d.kcal_total for d in resolved.days) * 1.1
    bars = []
    for day in resolved.days:
        pct = day.kcal_total / max_kcal * 100
        target_pct = target / max_kcal * 100
        bars.append(
            f'<div class="bar-row">'
            f'<div>{day.day}</div>'
            f'<div class="bar-bg"><div class="bar-fg" style="width:{pct:.1f}%"></div><div class="bar-target" style="left:{target_pct:.1f}%"></div></div>'
            f'<div>{day.kcal_total:.0f}</div>'
            f'</div>'
        )
    return "\n".join(bars)


def _render_schedule(resolved: ResolvedWeek) -> str:
    """Daily schedule tables."""
    DAY_EMOJI = {"training": "🏋️", "office": "🏢", "home": "🏠"}
    sections = []
    for day in resolved.days:
        emoji = DAY_EMOJI.get(day.day_type, "")
        rows = []
        for meal in day.meals:
            if not meal.items:
                # Marker row (e.g., iron_window_start)
                rows.append(f"<tr><td>{meal.time}</td><td colspan='3'><strong>{meal.name}</strong> <span class='ingredient-list'>{meal.notes or ''}</span></td></tr>")
                continue
            items_html = []
            for item in meal.items:
                name = item.dish_name or item.label or "—"
                marks = ""
                if item.from_stock:
                    marks += " <span class='stock-mark'>из дома</span>"
                if item.is_tail:
                    marks += " <span class='tail-mark'>🍬 хвост</span>"
                # Show ALL ingredients with full names
                ing_lines = []
                for i in item.ingredients:
                    note_suffix = f" <em>({i.note})</em>" if i.note else ""
                    fresh_mark = " <small style='color:#10b981'>•свеж</small>" if i.fresh_addon else ""
                    ing_lines.append(
                        f"<li>{i.name} — <strong>{i.qty_g:.0f}г</strong>{fresh_mark}{note_suffix}</li>"
                    )
                ings_html = f"<ul style='margin: 4px 0 0 0; padding-left: 20px;'>{''.join(ing_lines)}</ul>" if ing_lines else ""
                items_html.append(
                    f"<div style='margin-bottom: 8px;'><strong>{name}</strong>{marks}{ings_html}</div>"
                )
            tags_html = " ".join(f"<span class='tag'>{t}</span>" for t in meal.tags)
            kbju = f"{meal.kcal:.0f}К · {meal.protein_g:.0f}Б · {meal.fat_g:.0f}Ж · {meal.carbs_g:.0f}У"
            rows.append(
                f"<tr><td><strong>{meal.time}</strong></td>"
                f"<td>{meal.name}{tags_html}</td>"
                f"<td>{''.join(items_html)}</td>"
                f"<td>{kbju}<br><small>cum: {meal.cumulative_kcal:.0f}К</small></td></tr>"
            )
        notes_html = f'<div class="note">{day.notes}</div>' if day.notes else ""
        sections.append(
            f'<div class="day-header">'
            f'<div class="day-title">{day.day} {emoji} <small>({day.date})</small></div>'
            f'<div class="day-sum">{day.kcal_total:.0f}К · {day.protein_g_total:.0f}Б · {day.fat_g_total:.0f}Ж · {day.carbs_g_total:.0f}У</div>'
            f'</div>'
            f'{notes_html}'
            f'<table><thead><tr><th>Время</th><th>Приём</th><th>Состав</th><th>КБЖУ</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table>'
        )
    return "\n".join(sections)


def _render_shopping_rows(items: list[ShoppingItem]) -> str:
    """Rows for shopping table."""
    rows = []
    for item in items:
        if item.from_stock:
            continue
        plu_or_code = item.plu or item.code or "—"
        qty_str = f"{item.qty_buy_kg:.2f} кг" if item.qty_buy_kg > 0 else f"{item.qty_packages} {item.unit}"
        rows.append(
            f'<tr data-shop="{item.shop}">'
            f'<td>{item.shop}</td>'
            f'<td><code>{plu_or_code}</code></td>'
            f'<td>{item.name}</td>'
            f'<td>{qty_str}</td>'
            f'<td>{item.price_total_rub:.2f}</td>'
            f'</tr>'
        )
    return "\n".join(rows)


def _render_shop_filters(items: list[ShoppingItem]) -> str:
    """Filter buttons for shops."""
    shop_counts = {}
    for item in items:
        if item.from_stock:
            continue
        shop_counts[item.shop] = shop_counts.get(item.shop, 0) + 1
    buttons = []
    for shop, count in sorted(shop_counts.items(), key=lambda x: -x[1]):
        buttons.append(f"<button onclick=\"filterShop('{shop}', this)\">{shop} ({count})</button>")
    return "\n".join(buttons)


def _render_validation(issues: list[ValidationIssue]) -> str:
    """Validation report."""
    if not issues:
        return '<div class="note info">✅ Все проверки пройдены без замечаний.</div>'
    blocks = []
    by_sev = {"error": [], "warning": [], "info": []}
    for i in issues:
        by_sev[i.severity].append(i)
    for sev, label, css in [
        ("error", "🔴 Errors", "error"),
        ("warning", "🟡 Warnings", ""),
        ("info", "ℹ️ Info", "info"),
    ]:
        if not by_sev[sev]:
            continue
        items = []
        for issue in by_sev[sev]:
            loc = f" <small>({issue.location})</small>" if issue.location else ""
            items.append(f'<li><strong>[{issue.rule}]</strong> {issue.message}{loc}</li>')
        blocks.append(f'<div class="note {css}"><strong>{label}</strong><ul style="margin: 6px 0 0;">{"".join(items)}</ul></div>')
    return "\n".join(blocks)


def _render_actual_orders(plan: WeekPlan) -> str:
    """Show actual orders if present."""
    if not plan.actual_orders:
        return ""
    sections = ['<h2>🛍 Фактические заказы</h2>']
    for order in plan.actual_orders:
        rows = []
        for idx, item in enumerate(order.items, 1):
            plu = item.plu or "—"
            rows.append(
                f"<tr><td>{idx}</td><td><code>{plu}</code></td><td>{item.name}</td>"
                f"<td>{item.qty} {item.unit}</td><td>{item.price_rub_total:.2f}</td></tr>"
            )
        sections.append(
            f'<details>'
            f'<summary>{order.shop} № {order.order_id} — {order.paid_rub:.2f}₽ ({len(order.items)} поз.)</summary>'
            f'<table><thead><tr><th>#</th><th>PLU</th><th>Товар</th><th>Кол-во</th><th>Сумма ₽</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table>'
            f'<p style="font-size: 13px; color: #6e6e73;">'
            f'Сборка: +{order.packing_fee_rub:.2f}₽ · Скидка: −{order.discount_rub:.2f}₽ · '
            f'<strong>Итого: {order.paid_rub:.2f}₽</strong>'
            f'</p>'
            f'</details>'
        )
    return "\n".join(sections)


def generate_html(plan_path: Path, output_path: Path) -> None:
    """Generate self-contained HTML viewer."""
    from datetime import datetime

    plan = load_week_plan(plan_path)
    resolver = Resolver()
    resolved = resolver.resolve_week(plan)
    items = compute_shopping_items(resolved, plan, resolver)
    summary = summarize_by_shop(items)
    validator = Validator()
    issues = validator.validate(resolved, plan, summary)

    target = resolved.targets
    avg_kcal = sum(d.kcal_total for d in resolved.days) / 7
    avg_protein = sum(d.protein_g_total for d in resolved.days) / 7
    avg_fat = sum(d.fat_g_total for d in resolved.days) / 7
    avg_carbs = sum(d.carbs_g_total for d in resolved.days) / 7
    budget_total = sum(s["total_rub"] for s in summary.values())

    def stat_color(actual, target, lower_is_better=False):
        ratio = actual / target if target else 0
        if 0.95 <= ratio <= 1.05:
            return "good"
        if 0.85 <= ratio <= 1.15:
            return "warn"
        return "bad"

    html = HTML_TEMPLATE.format(
        week_id=plan.week_id,
        start_date=plan.start_date,
        end_date=plan.end_date,
        target_kcal=target["kcal_per_day"],
        target_protein=target["protein_g_per_day"],
        target_fat=target["fat_g_per_day"],
        target_carbs=target["carbs_g_per_day"],
        avg_kcal=avg_kcal,
        avg_protein=avg_protein,
        avg_fat=avg_fat,
        avg_carbs=avg_carbs,
        budget_total=budget_total,
        kcal_color=stat_color(avg_kcal, target["kcal_per_day"]),
        protein_color=stat_color(avg_protein, target["protein_g_per_day"]),
        budget_color="bad" if budget_total > plan.budget.target_rub_per_week else "good",
        kcal_bars=_render_kcal_bars(resolved),
        schedule_html=_render_schedule(resolved),
        total_items=sum(1 for i in items if not i.from_stock),
        shop_filters=_render_shop_filters(items),
        shopping_rows=_render_shopping_rows(items),
        actual_orders_html=_render_actual_orders(plan),
        validation_html=_render_validation(issues),
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        plan_path=plan_path.name,
        catalog_count=len(resolver.catalog._spb),
    )

    output_path.write_text(html, encoding="utf-8")
    print(f"✓ HTML viewer → {output_path}")
    print(f"  Open: file://{output_path.absolute()}")
