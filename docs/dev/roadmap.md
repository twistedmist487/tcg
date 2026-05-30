# Development Roadmap

This document tracks the development plan for Conspiracy TCG.

## Phase 0: Project Scaffolding [COMPLETE]
Goal: Clean, navigable project structure with tooling wired up.

- [x] Initialize git repo with .gitignore
- [x] Create root README.md
- [x] Create AGENTS.md for AI cocreators
- [x] Reorganize docs/ into design/ and dev/
- [x] Add pyproject.toml with tooling config
- [x] Create Makefile with common commands
- [x] Write Phase 0 validation script (card schema checker)

## Phase 1: Data Model Hardening [COMPLETE]
Goal: Robust, validated card data model.

- [x] Create Pydantic Card models (Character, Spell, Location)
- [x] Create Pydantic Faction model
- [x] Write card loader using Pydantic models
- [x] Add 18 tests for models and loader (29 total with Phase 0)
- [x] Validate all 12 existing cards against new models

## Phase 2: Game Engine -- Core Logic [PENDING]
Goal: Python game engine, two-human CLI play.

## Phase 3: Card Expansion [PENDING]
Goal: 30+ cards per faction, deckbuilder tool.

## Phase 4: Single-Player vs AI [PENDING]
Goal: Play against a heuristic AI opponent.

## Phase 5: Web Playable Prototype [PENDING]
Goal: Browser-based UI with FastAPI backend.

## Phase 6: Playtest & Iterate [PENDING]
Goal: Balance tuning based on real games.
