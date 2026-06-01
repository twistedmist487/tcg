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

## Phase 6: Spell & Location Resolution [COMPLETE]
Goal: Cards that actually do something when played.

- [x] engine/effects.py -- effect resolution system (damage, heal, draw, silence, buff, debuff, bounce, destroy, mind control)
- [x] Spell dispatcher that reads card effect text and routes to handlers
- [x] Trigger system: on-play character abilities, start-of-turn location effects, end-of-turn location effects, ongoing auras
- [x] All 27 existing cards resolve effects in gameplay
- [x] Integrated into Game.play_card(), start_turn(), end_turn()
- [x] Added spell_target_index parameter to play_card for targeted spells
- [x] Fixed AI execute_turn to always end turn even on failed plays
- [x] 39 new tests for effect resolution (166 total)
- [x] Real card effects: Divine Smite deals 4 damage, Media Blackout silences all, Sacred Chapel heals 1 each turn, etc.

---

## Phase 7: Content Expansion [IN PROGRESS]
Goal: Make decks feel complete and gameplay more varied.

**Completed:**
- [x] 10+ new cards per faction (30+ new total, 90 cards / 30 per faction)
- [x] Fill gameplay gaps: Illuminati (more discard/control/stealth), Templars (more healing/buffs/charge), Reptilians (more stealth/swarm/summon)
- [x] Higher cost cards (7-10 mana) for late-game impact — 3 new legendaries
- [x] New card mechanics: Charge, Deathrattle (on-death summon), Stealth assassins
- [x] Each faction gets a Legendary character (cost 8-10, powerful unique effect)
- [x] Curated 30-card faction decks in data/decks.json
- [x] Deck validation: enforce 30 cards, single faction, max 3 copies
- [x] Mulligan system (redraw starting hand before first turn)

**Balancing Pass:**
- Playtesting with AI to identify overpowered/undercosted cards
- Adjust stats and costs based on win rates

---

## Phase 8: Deck Builder & Matchmaking [PENDING]
Goal: Build custom decks and play against other humans online.

**Deck Builder UI:**
- Web UI for selecting cards from collection
- Filter by faction, cost, type, keyword
- Save/load deck configurations as JSON
- Deck naming and sharing

**Online Play:**
- WebSocket-based real-time multiplayer (replaces REST polling)
- Game lobby: create/join rooms, faction selection
- Matchmaking queue (random opponent by faction preference)
- Spectator mode (watch ongoing games)
- Chat between players
- Reconnection handling (resume dropped games)
- Game history and replay viewer

**Backend changes:**
- server/websocket.py -- WebSocket endpoint for real-time game state broadcast
- server/lobby.py -- room management, matchmaking queue, player sessions
- Database layer (SQLite) for persistent decks, game history, player profiles
- Authentication (simple token-based) for player accounts

---

## Phase 9: Polish & Visual Improvements [PENDING]
Goal: Make the game feel complete and replayable.

**AI Improvements:**
- Multiple AI difficulty levels (Easy, Medium, Hard)
- Hard AI uses look-ahead (minimax with 2-3 ply search)
- Aggro/Control/Midrange AI deck preferences

**Visual Polish:**
- Card art placeholders with faction-themed icons
- Damage animations, play effects, turn transitions
- Sound effects (optional, browser-based)
- Responsive mobile-friendly layout

**Quality of Life:**
- Keyboard shortcuts
- Undo last action (single-player only)
- Game speed settings
- Comprehensive help/tutorial page
- Card collection browser with search/filter
- Export/import game state for debugging

---

*Total tests: 197 (as of Phase 7 content expansion)*
*Total cards: 90 (30 per faction: 14 chars, 10 spells, 6 locs)*
*Total code files: 31 Python + 3 frontend*
*Curated 30-card faction decks in data/decks.json*
