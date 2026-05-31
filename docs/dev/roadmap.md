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

- [x] CardInstance: mutable runtime state (health, buffs, stealth, etc.)
- [x] Player state: deck, hand, board, life, energy management
- [x] Combat resolution: character vs character, direct attacks, simultaneous damage
- [x] Keyword mechanics: Taunt, Stealth, Silence, Exhausted
- [x] Game engine: turn loop, setup, win conditions, action dispatch
- [x] JSON serialization: save/load full game state
- [x] CLI game: two-human text interface with faction selection
- [x] 65 new tests (94 total) covering all engine modules

## Phase 3: Card Expansion [COMPLETE]
Goal: 8+ cards per faction, new thematic depth.

- [x] 15 new cards (5 per faction) validated via schema checker
- [x] Illuminati: Corporate control, human weapons, government programs themes
- [x] Templars: Esoteric warfare, sacred artifacts, divine intervention themes
- [x] Reptilians: Space/orbital weapons, ancient aliens, tech subversion themes
- [x] Expanded factions.md with 9 new sample cards + 3 theme sections
- [x] Balance-tuned stats to match cost heuristics
- [x] 27 total cards (12 original + 15 new)

## Phase 4: Single-Player vs AI [COMPLETE]
Goal: Play against a heuristic AI opponent.

- [x] Rule-based AIPlayer with faction-specific scoring weights
- [x] Action evaluation: play, attack, end turn with board-state heuristics
- [x] Faction flavor: Illuminati (card draw/control), Templars (defense/healing), Reptilians (aggression)
- [x] execute_turn() for full AI turn loop
- [x] 19 new tests covering AI behavior and full game completion
- [x] CLI mode selector: 2-player or vs AI

## Phase 5: Web Playable Prototype [COMPLETE]
Goal: Browser-based UI with FastAPI backend.

- [x] FastAPI REST API: new game, play, attack, end turn, state, sessions
- [x] In-memory session management with 30-card deck building
- [x] Dark-themed responsive HTML/CSS/JS frontend (no build step)
- [x] Faction selection, card rendering, board display, game log
- [x] Start Turn / Play / Attack / End Turn action flow
- [x] Client-side AI auto-play after human ends turn
- [x] get_state() enriched with faction, cost, ability/effect data
- [x] 14 new server tests (127 total)
- [x] Run with: uvicorn server.app:app --port 8080

---

## Phase 6: Spell & Location Resolution [PENDING]
Goal: Cards that actually do something when played.

Currently spells and locations are played but their effects are not resolved — they just spend energy and discard. This phase implements the card effect engine so that every card in the pool has a meaningful, working ability.

**What needs building:**
- `engine/effects.py` — effect resolution system (damage, heal, draw, silence, buff, debuff, bounce, destroy, etc.)
- Effect parser that reads card ability/effect text and dispatches to the right handler
- Trigger system for "when played", "on attack", "start of turn", "on death" effects
- Location persistence and ongoing effect application
- Update all 27 cards to have proper effects reflected in gameplay
- Balancing pass after effects are live

**Example effects to implement:**
- Direct damage spells (Neural Scramble: -2 ATK, Divine Smite: 4 damage)
- AOE (Orbital Strike: 6 to target + 3 to others)
- Card draw (Black Budget: draw 2, each discards 1)
- Mind control (Manchurian Protocol: take control of enemy)
- Healing (Absolution: restore 5 HP)
- Stat buffs/debuffs (Corporate Gauntlet: enemy cards cost +1)
- Taunt activation (Templar Guardian, Relic Keeper)
- Stealth activation (Shape-Shifter Infiltrator)
- Location effects (Sacred Chapel: heal 1 each turn)

**Tests:** ~20 new tests for effect resolution

---

## Phase 7: Deck Builder & Matchmaking [PENDING]
Goal: Build custom decks and play against other humans online.

**Deck Builder:**
- Web UI for selecting cards from your collection
- Enforce deck rules: 30 cards max, 3 copies per card, single faction
- Save/load deck configurations as JSON
- Mulligan system (redraw starting hand)

**Online Play:**
- WebSocket-based real-time multiplayer (replaces REST polling)
- Game lobby: create/join rooms, faction selection
- Matchmaking queue (random opponent)
- Spectator mode (watch ongoing games)
- Chat between players
- Reconnection handling (resume dropped games)
- Game history and replay viewer

**Backend changes:**
- `server/websocket.py` — WebSocket endpoint for real-time game state broadcast
- `server/lobby.py` — room management, matchmaking queue, player sessions
- Database layer (SQLite) for persistent decks, game history, player profiles
- Authentication (simple token-based) for player accounts

---

## Phase 8: Content Expansion & Polish [PENDING]
Goal: Make the game feel complete and replayable.

**More Cards:**
- 12-15 more cards per faction (40+ total per faction, 120+ overall)
- New card mechanics: Charge (can attack same turn), Deathrattle, Secrets, Combo
- Legendary cards (1 per faction, powerful unique effects)
- Neutral cards usable by any faction

**AI Improvements:**
- Multiple AI difficulty levels (Easy, Medium, Hard)
- Hard AI uses look-ahead (minimax with 2-3 ply search)
- Aggro/Control/Midrange AI deck preferences

**Visual Polish:**
- Card art placeholders with faction-themed icons
- Damage animations, play effects, turn transitions
- Sound effects (optional, browser-based)
- Responsive mobile-friendly layout
- Keyboard shortcuts for CLI mode

**Quality of Life:**
- Undo last action (single-player only)
- Game speed settings
- Export/import game state for debugging
- Comprehensive help/tutorial page
- Card collection browser with search/filter

---

*Total tests: 127 (as of Phase 5 completion)*
*Total cards: 27*
*Total code files: 27 Python + 3 frontend*
