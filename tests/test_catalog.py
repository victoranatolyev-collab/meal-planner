"""Catalog loader tests."""
import pytest

from meal_planner.catalog import load_catalog, Catalog


@pytest.fixture
def catalog():
    return load_catalog()


def test_catalog_loads(catalog):
    assert len(catalog._spb) > 1000, "Должен загрузиться каталог Пятёрочки"
    assert len(catalog._custom) > 10, "Должны быть кастомные ингредиенты"


def test_resolve_plu(catalog):
    ing = catalog.resolve("plu:3191298")
    assert ing is not None
    assert "грудк" in ing.name.lower() or "куриц" in ing.name.lower()
    assert ing.shop == "Пятёрочка"
    assert ing.kcal_per_100g > 0


def test_resolve_local(catalog):
    ing = catalog.resolve("local:mw_mini")
    assert ing is not None
    assert ing.shop == "дома"
    assert ing.weight_g == 26


def test_resolve_nonexistent_plu_returns_none(catalog):
    ing = catalog.resolve("plu:99999999")
    assert ing is None


def test_resolve_nonexistent_local_returns_none(catalog):
    ing = catalog.resolve("local:nonexistent_id")
    assert ing is None


def test_invalid_ref_format_raises(catalog):
    with pytest.raises(ValueError):
        catalog.resolve("missing_namespace_separator")
    with pytest.raises(ValueError):
        catalog.resolve("unknown:id")


def test_kbju_calculation(catalog):
    ing = catalog.resolve("local:mw_mini")
    # 26г бара, 452 ккал/100г → 117.5 ккал
    kbju = ing.kbju(26)
    assert abs(kbju["kcal"] - 117.5) < 1
    assert abs(kbju["protein_g"] - 0.7) < 0.1


def test_cost_calculation_per_unit(catalog):
    ing = catalog.resolve("local:ts_15_carry_sandwich")
    # 1 шт × 179 = 179
    assert ing.cost(qty_units=1) == 179


def test_cost_per_kg(catalog):
    # PLU 3191298 = курица грудка, цена 239.99/кг
    ing = catalog.resolve("plu:3191298")
    cost_100g = ing.cost(qty_g=100)
    assert 20 < cost_100g < 30  # ~24₽


def test_search(catalog):
    # Use single word for fuzzy match (Pyat catalog: "Грудка куриная охлажденная")
    results = catalog.search("Грудка", limit=5)
    assert len(results) >= 1
    assert any("грудк" in r.name.lower() for r in results)
