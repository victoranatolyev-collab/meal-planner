"""
Catalog loader for ingredients across multiple sources.

Sources (priority order — first match wins):
1. WeekPlan.ingredients_local (week-specific overrides)
2. data/custom_ingredients.json (Цех 85, ЛЛ, домашние запасы, Маркетплейс)
3. data/ingredients_spb.json (Пятёрочка СПб 5590)

Reference format:
- "plu:3191298"     → ingredients_spb.json (PLU as key)
- "local:<id>"      → custom_ingredients.json / week.ingredients_local

Returns NormalizedIngredient with unified fields regardless of source.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from .schema import LocalIngredient, WeekPlan
from .config import DATA_DIR


@dataclass
class NormalizedIngredient:
    """Unified view of an ingredient regardless of source."""

    ref: str  # original ref ("plu:..." | "local:...")
    id: str  # stripped ref
    name: str
    shop: Optional[str] = None  # "Пятёрочка" | "Цех 85" | "ЛЛ" | "дома" | "Маркетплейс"
    plu: Optional[str] = None
    code: Optional[str] = None
    unit: str = "шт"
    weight_g: float = 0  # package size; 0 if weight-based goods (per kg)
    kcal_per_100g: float = 0
    protein_per_100g: float = 0
    fat_per_100g: float = 0
    carbs_per_100g: float = 0
    price_rub: float = 0  # per package (if weight_g>0) or per unit; for kg-based: price_rub_per_kg
    price_per_kg: Optional[float] = None  # for items priced per kg
    category: Optional[str] = None
    source: str = "unknown"  # which file provided the data
    notes: Optional[str] = None

    def kbju(self, qty_g: float) -> dict:
        """Return KBJU for given quantity in grams."""
        factor = qty_g / 100.0
        return {
            "kcal": round(self.kcal_per_100g * factor, 1),
            "protein_g": round(self.protein_per_100g * factor, 2),
            "fat_g": round(self.fat_per_100g * factor, 2),
            "carbs_g": round(self.carbs_per_100g * factor, 2),
        }

    def cost(self, qty_g: float = 0, qty_units: float = 0) -> float:
        """Calculate cost for given quantity."""
        if self.price_per_kg is not None and qty_g > 0:
            return round(self.price_per_kg * qty_g / 1000.0, 2)
        if qty_units > 0:
            return round(self.price_rub * qty_units, 2)
        if qty_g > 0 and self.weight_g > 0:
            return round(self.price_rub * qty_g / self.weight_g, 2)
        return 0.0


class Catalog:
    """Unified catalog combining Pyaterochka SPB + custom ingredients + week overrides."""

    def __init__(self, data_dir: Optional[Path] = None, week_overrides: Optional[dict[str, LocalIngredient]] = None):
        self.data_dir = data_dir or DATA_DIR
        self._spb: dict[str, dict] = {}  # plu (str) → product
        self._custom: dict[str, LocalIngredient] = {}
        self._week_overrides: dict[str, LocalIngredient] = week_overrides or {}
        self._load()

    def _load(self) -> None:
        # 1. Пятёрочка SPB
        spb_path = self.data_dir / "ingredients_spb.json"
        if spb_path.exists():
            with spb_path.open(encoding="utf-8") as f:
                data = json.load(f)
            # Products keyed by PLU as string
            products = data.get("products", {})
            self._spb = {str(plu): product for plu, product in products.items()}

        # 2. Custom (Цех 85, ЛЛ, дом, Маркетплейс)
        custom_path = self.data_dir / "custom_ingredients.json"
        if custom_path.exists():
            with custom_path.open(encoding="utf-8") as f:
                data = json.load(f)
            for ing_id, ing_data in data.get("ingredients", {}).items():
                self._custom[ing_id] = LocalIngredient(**ing_data)

    def resolve(self, ref: str) -> Optional[NormalizedIngredient]:
        """Resolve a reference string to a NormalizedIngredient. Returns None if not found."""
        if ":" not in ref:
            raise ValueError(f"Invalid ref format (missing ':' prefix): {ref}")
        namespace, ref_id = ref.split(":", 1)

        if namespace == "plu":
            return self._resolve_plu(ref_id)
        elif namespace == "local":
            return self._resolve_local(ref_id)
        else:
            raise ValueError(f"Unknown ref namespace: {namespace} (expected plu | local)")

    def _resolve_plu(self, plu: str) -> Optional[NormalizedIngredient]:
        product = self._spb.get(str(plu))
        if not product:
            return None

        kbju = product.get("kbju") or {}
        weight = product.get("weight") or {}
        prices = product.get("prices") or {}
        regular_price = prices.get("regular") or 0.0

        weight_g = weight.get("grams", 0) or 0
        uom = product.get("uom", "шт")

        # Determine if it's per-kg pricing (uom='кг') or per-unit
        is_per_kg = uom == "кг" or weight_g == 0
        price_per_kg = None
        if is_per_kg:
            price_per_kg = regular_price

        return NormalizedIngredient(
            ref=f"plu:{plu}",
            id=str(plu),
            name=product.get("name", ""),
            shop="Пятёрочка",
            plu=str(plu),
            unit=uom,
            weight_g=weight_g,
            kcal_per_100g=kbju.get("kcal", 0) or 0,
            protein_per_100g=kbju.get("protein", 0) or 0,
            fat_per_100g=kbju.get("fat", 0) or 0,
            carbs_per_100g=kbju.get("carbs", 0) or 0,
            price_rub=regular_price,
            price_per_kg=price_per_kg,
            category=self._category_from_pyat_product(product),
            source="ingredients_spb.json",
        )

    @staticmethod
    def _category_from_pyat_product(product: dict) -> Optional[str]:
        cats = product.get("categories", [])
        if not cats:
            return None
        # Pick the second-level part of the first category like "Готовая еда / Завтраки" → "Завтраки"
        first = cats[0]
        if " / " in first:
            return first.split(" / ", 1)[1].split(" / ")[0]
        return first

    def _resolve_local(self, ref_id: str) -> Optional[NormalizedIngredient]:
        # Check week overrides first
        local = self._week_overrides.get(ref_id) or self._custom.get(ref_id)
        if not local:
            return None

        return NormalizedIngredient(
            ref=f"local:{ref_id}",
            id=ref_id,
            name=local.name,
            shop=local.shop,
            plu=local.plu,
            code=local.code,
            unit=local.unit,
            weight_g=local.weight_g,
            kcal_per_100g=local.kcal_per_100g,
            protein_per_100g=local.protein_per_100g,
            fat_per_100g=local.fat_per_100g,
            carbs_per_100g=local.carbs_per_100g,
            price_rub=local.price_rub,
            category=local.category,
            source="custom_ingredients.json" if ref_id in self._custom else "week_override",
            notes=local.notes,
        )

    def search(self, query: str, limit: int = 20) -> list[NormalizedIngredient]:
        """Fuzzy search by name. Returns ranked list."""
        query_lower = query.lower()
        results = []

        for plu, product in self._spb.items():
            name = product.get("name", "").lower()
            if query_lower in name:
                ing = self._resolve_plu(plu)
                if ing:
                    results.append(ing)

        for ref_id, local in self._custom.items():
            if query_lower in local.name.lower():
                ing = self._resolve_local(ref_id)
                if ing:
                    results.append(ing)

        # Rank: name starts with query > contains
        results.sort(key=lambda x: (0 if x.name.lower().startswith(query_lower) else 1, len(x.name)))
        return results[:limit]

    def with_week_overrides(self, week: WeekPlan) -> "Catalog":
        """Return a new catalog instance with this week's local ingredient overrides applied."""
        return Catalog(data_dir=self.data_dir, week_overrides=week.ingredients_local)


def load_catalog(data_dir: Optional[Path] = None) -> Catalog:
    """Convenience factory."""
    return Catalog(data_dir=data_dir)
