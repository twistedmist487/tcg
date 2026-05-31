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

## Phase 2: Game Engine -- Core Logic [COMPLETE]
Goal: Python game engine, two-human CLI play.

- [x] CardInstance — mutable runtime state (health, buffs, stealth, etc.)
- [x] Player state — deck, hand, board, life, energy management
- [x] Combat resolution — character vs character, direct attacks, simultaneous damage
- [x] Keyword mechanics — Taunt, Stealth, Silence, Exhausted
- [x] Game engine — turn loop, setup, win conditions, action dispatch
- [x] JSON serialization — save/load full game state
- [x] CLI game — two-human text interface with faction selection
- [x] 65 new tests (94 total) covering all engine modules

## Phase 3: Card Expansion [COMPLETE]
Goal: 8+ cards per faction, new thematic depth.

- [x] 15 new cards (5 per faction) validated via schema checker
- [x] Illuminati: Corporate control, human weapons, government programs themes
- [x] Templars: Esoteric warfare, sacred artifacts, divine intervention themes
- [x] Reptilians: Space/orbital weapons, ancient aliens, tech subversion themes
- [x] Expanded factions.md with 9 new sample cards + 3 new theme sections
- [x] Balance-tuned stats to match cost heuristics
- [x] 27 total cards (12 original + 15 new)

## Phase 4: Single-Player vs AI [PENDING]
Goal: Play against a heuristic AI opponent.

## Phase 5: Web Playable Prototype [PENDING]
Goal: Browser-based UI with FastAPI backend.

## Phase 6: Playtest & Iterate [PENDING]
Goal: Balance tuning based on real games.
