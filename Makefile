.PHONY: help install validate balance lint test clean

PYTHON = python3
PIP = pip3

# Default target: show help
help: ## Show this help message
	@echo "Conspiracy TCG -- Available Commands"
	@echo "====================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install Python dependencies
	$(PIP) install pydantic pytest ruff --break-system-packages

validate: ## Validate all cards against schema
	$(PYTHON) -m tools.validate_cards

balance: ## Run balance check on all cards
	$(PYTHON) -m agents.rules_agent

lint: ## Run ruff linter
	ruff check .

test: ## Run pytest test suite
	$(PYTHON) -m pytest

clean: ## Clean build artifacts and cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null
	rm -rf .pytest_cache .ruff_cache .mypy_cache htmlcov
	rm -rf dist build *.egg-info
