# Meal Planner — common commands
# Использование: make help

.PHONY: help setup install test render shopping validate report html all clean lint

PLAN ?= plans/week_2026-W21.json
PYTHON := .venv/bin/python
PIP := .venv/bin/pip

help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Полный setup: создать .venv + установить deps + прогнать тесты
	./setup.sh

install: ## Только установить зависимости (предполагает .venv)
	$(PIP) install -e ".[test]"

test: ## Запустить pytest
	$(PYTHON) -m pytest tests/ -v

render: ## Сгенерировать markdown из плана (PLAN=plans/week_*.json)
	$(PYTHON) -m meal_planner render $(PLAN)

shopping: ## Сгенерировать shopping_list.csv
	$(PYTHON) -m meal_planner shopping $(PLAN)

validate: ## Прогнать валидатор
	$(PYTHON) -m meal_planner validate $(PLAN)

report: ## Rich-сводка в терминал
	$(PYTHON) -m meal_planner report $(PLAN)

order-match: ## Сверить факт-заказ с планом
	$(PYTHON) -m meal_planner order-match $(PLAN)

html: ## Сгенерировать HTML-вьюер
	$(PYTHON) -m meal_planner html $(PLAN)

all: ## Все артефакты: md + csv + validate + html + report
	$(PYTHON) -m meal_planner all $(PLAN)

view: ## Открыть HTML в браузере
	open output/weekly_plan.html

create: ## Интерактивно создать новый план
	$(PYTHON) -m meal_planner create

edit: ## Интерактивно править план (PLAN=...)
	$(PYTHON) -m meal_planner edit $(PLAN)

clean: ## Удалить output/, кэш Python
	rm -rf output/*.{md,csv,html} 2>/dev/null || true
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

debug-paths: ## Показать какие пути использует приложение
	$(PYTHON) -c "from meal_planner.config import info; import json; print(json.dumps(info(), indent=2))"
