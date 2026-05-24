#!/usr/bin/env bash
# Setup script — устанавливает зависимости и проверяет работоспособность.
# Использование: ./setup.sh

set -euo pipefail
cd "$(dirname "$0")"

echo "🔧 Meal Planner setup"
echo ""

# 1. Проверить Python
if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ python3 не найден. Установи Python 3.10+"
    exit 1
fi

PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✓ Python $PY_VER"

# 2. Создать .venv если нет
if [ ! -d ".venv" ]; then
    echo "🔨 Создаю виртуальное окружение..."
    python3 -m venv .venv
fi

# 3. Активировать и обновить pip
source .venv/bin/activate
pip install --upgrade pip --quiet

# 4. Установить зависимости (как пакет в editable mode)
echo "📦 Устанавливаю зависимости..."
pip install -e ".[test]" --quiet

# 5. Прогнать тесты
echo "🧪 Тесты..."
pytest tests/ -q

# 6. Сгенерировать примеры
echo ""
echo "🎬 Демо-запуск (плановая неделя 2026-W21):"
python -m meal_planner all plans/week_2026-W21.json | head -10

echo ""
echo "✅ Готово!"
echo ""
echo "Используй:"
echo "  source .venv/bin/activate"
echo "  python -m meal_planner --help"
echo ""
echo "Или короткие алиасы (после активации .venv):"
echo "  mp all plans/week_2026-W21.json"
echo "  meal-planner report plans/week_2026-W21.json"
echo ""
echo "HTML-вьюер: open output/weekly_plan.html"
