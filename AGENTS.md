# AGENTS.md -- Guide for AI Cocreators

This document is for AI coding assistants (and human contributors) working on
the Conspiracy TCG project. Read this before making changes.

## Project Overview

Conspiracy TCG is a Python-based strategic card game with three conspiracy-
themed factions. The project is feature-complete through Phase 5 with a
playable web UI, CLI, AI opponent, and 27 cards (9 per faction). It uses a
data-driven design: all cards and factions are defined in JSON files and
loaded by Pydantic-validated models. The game engine is pure Python with zero
UI dependencies -- CLI, web UI, and AI all wrap around the same engine.

**Tech Stack:** Python 3.12+, Pydantic 2.x, FastAPI, pytest, ruff

## Current Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Project scaffolding, tooling, git | COMPLETE |
| 1 | Pydantic data models, loaders, validation | COMPLETE |
| 2 | Game engine (Game, Player, CardInstance, Combat, Keywords) | COMPLETE |
| 3 | Card expansion (27 cards, 9 per faction) | COMPLETE |
| 4 | Heuristic AI opponent with faction weights | COMPLETE |
|| 5 | FastAPI web server + browser UI | COMPLETE |
|| 6 | Spell & location effect resolution engine | COMPLETE |
|| 7 | Deck builder + WebSocket online multiplayer | PENDING |
|| 8 | Content expansion (120+ cards) & polish | PENDING |

**Stats:** 197 tests, 90 cards (30 per faction), 30 Python source files, 3 frontend files

## Directory Layout

```
agents/              AI helper agents (lore gen, balance checking)
  base_agent.py      Base class with data CRUD and JSON loading
  lore_agent.py      Generates card lore from faction data
  rules_agent.py     Evaluates card balance with stat-to-cost heuristics
cli/                 Command-line game runner
  game.py            Two-human and vs-AI text interface with faction select
data/                JSON data store
  cards.json         27 game cards (9 per faction: 5 chars, 2 spells, 2 locs)
  factions.json      3 faction definitions with energy types and mechanics
docs/design/         Game design documents
  game_concept.md    Theme, USPs, core gameplay loop
  factions.md        Detailed faction lore, all card listings
  rules.md           Complete game rules, turn structure, keywords
docs/dev/            Developer reference
  data-model.md      Full card schema, engine API, game state structure
  roadmap.md         Development plan with all phases
  plans/             Implementation plans for completed phases
engine/              Game engine -- NO UI dependencies
  __init__.py        Public API exports
  models.py          Pydantic Card/Faction models and JSON loaders
  game.py            Game state, turn loop, action dispatch, win conditions
  player.py          Player state (deck, hand, board, life, energy, fatigue)
  card.py            CardInstance runtime state on the board
  combat.py          Attack/block/damage resolution, CombatResult
  keywords.py        Taunt, Stealth, Silence, Exhausted mechanics
  serializer.py      Full game state save/load via JSON
  ai.py              Rule-based AI agent with faction-specific scoring weights
server/              FastAPI web server
  __init__.py
  app.py             REST API endpoints + static file serving
  session.py         In-memory game session management
static/              Web frontend (no build step)
  index.html         SPA shell with faction selection and game board
  style.css          Dark-themed responsive CSS with faction colors
  app.js             Game UI logic, API calls, client-side AI auto-play
tests/               127 tests across 8 test files
  test_models.py     Pydantic model validation (11 tests)
  test_card.py       CardInstance runtime state (23 tests)
  test_combat.py     Combat resolution (9 tests)
  test_keywords.py   Keyword mechanics (11 tests)
  test_player.py     Player state management (22 tests)
  test_ai.py         AI behavior and scoring (19 tests)
  test_server.py     FastAPI endpoint tests (14 tests)
  test_validate_cards.py Card schema validation (11 tests)
  test_models.py     Model loaders and factions (7 tests)
tools/               Utility scripts
  validate_cards.py  Card schema validator
```

## Data Model

### Card (defined in engine/models.py)

All cards are validated through Pydantic models:

| Model         | Type disp. | Extra fields                        |
|---------------|------------|-------------------------------------|
| CharacterCard | "Character"| attack (int), health (int), ability |
| SpellCard     | "Spell"    | effect (str)                        |
| LocationCard  | "Location" | effect (str)                        |

**Usage:**
```python
from engine.models import load_cards, load_factions
cards = load_cards("data/cards.json")
factions = load_factions("data/factions.json")
```

**Card ID format:** `{faction}_{type_prefix}_{3-digit-number}`
Examples: `illuminati_char_001`, `templars_spell_002`, `reptilians_loc_002`

### Game State (from game.get_state())

```python
{
  "turn": 3,
  "active_player": "Player Name",
  "players": [{
    "name": "Player Name",
    "life": 25,
    "energy": 3,
    "max_energy": 4,
    "hand_size": 4,
    "deck_size": 19,
    "hand": [{"name": ..., "cost": ..., "faction": ..., "type": ..., ...}],
    "board": [{"name": ..., "cost": ..., "faction": ..., "attack": ...,
               "health": ..., "exhausted": ..., "stealth": ...,
               "silenced": ..., "taunt": ..., "damage_taken": ...}],
    "location": {"name": ...} | null
  }, ...],
  "is_over": false,
  "winner": null
}
```

### Adding a New Card

1. Pick a unique ID: `{faction}_{char|spell|loc}_{nnn}`
2. Add the card object to the array in `data/cards.json`
3. Validate: `make validate`
4. Balance-check: `make balance`
5. Run tests: `make test`
6. Commit: `cards: add {card name} ({faction} {type})`

### Adding a New Faction

1. Add to `data/factions.json` with name, energy_type, lore_summary, key_mechanics
2. Add detailed faction entry in `docs/design/factions.md`
3. Create initial cards (at least 4: 2 chars, 1 spell, 1 location)
4. Update this doc and data-model.md

## Game Engine API

### Core Engine (engine/game.py)

```python
# Setup
game = Game.setup(deck1, deck2, "Alice", "Bob")

# Turn loop
while not game.is_over:
    game.start_turn()          # Draw, gain energy, clear exhaustion
    game.play_card(0)          # Play hand card by index
    game.attack(0, None)       # Attack face
    game.attack(0, 1)          # Attack enemy board[1]
    game.end_turn()            # Cleanup, switch player

# State
state = game.get_state()       # Full serializable dict
winner = game.winner           # Name or None
```

### Player State (engine/player.py)

```python
player.hand       # List of Card objects
player.board      # List of CardInstance objects
player.deck       # List of Card objects (remaining)
player.life       # Current life (starts at 30)
player.energy     # Current energy available
player.max_energy # Energy cap (grows by 1 per turn, max 20)
player.location   # CardInstance or None
player.draw_card()          # Returns Card or None (fatigue)
player.play_card(card)      # Play from hand, returns CardInstance
player.can_play_card(card)  # Check energy sufficiency
player.spend_energy(n)      # Returns True if affordable
player.remove_dead_characters()  # Returns list of dead CardInstances
```

### Combat (engine/combat.py)

```python
result = resolve_attack(attacker, attacker_owner, opponent, defender=None)
# result.damage_dealt_to_defender
# result.damage_dealt_to_attacker
# result.attacker_dead
# result.defender_dead

# Valid targets (respects Taunt and Stealth)
targets = get_valid_attack_targets(attacker_owner, opponent)
can_hit_face = can_attack_player_directly(attacker_owner, opponent)
```

### Keywords (engine/keywords.py)

```python
has_taunt(character)     # Must be attacked first
has_stealth(character)   # Untargetable until it attacks
is_silenced(character)   # Abilities suppressed
is_exhausted(character)  # Can't attack (summoning sickness)
apply_silence(character)
remove_stealth(character)
clear_all_exhaustion(game, player)
```

### AI (engine/ai.py)

```python
ai = AIPlayer(name="Bot", faction="illuminati", aggression=0.7)
action = choose_action(game)        # Returns {"action": "play", "card_index": N}
                                     #      or {"action": "attack", ...}
                                     #      or {"action": "end_turn"}
results = execute_turn(game, ai)    # Full AI turn loop
score = score_action(game, action)  # Score any action
```

### Serialization (engine/serializer.py)

```python
json_str = serialize_game(game)     # Full state to JSON
game = deserialize_game(json_str)   # Reconstruct game from JSON
```

## Web Server API (server/app.py)

**Run:** `uvicorn server.app:app --port 8080`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Serves index.html frontend |
| GET | /api/cards | All card definitions |
| POST | /api/game/new?player_name=&player_faction= | Create game |
| GET | /api/game/{id}/state | Current game state |
| POST | /api/game/{id}/start-turn | Start turn (draw, energy) |
| POST | /api/game/{id}/play?card_index=N | Play card |
| POST | /api/game/{id}/attack | Attack with body |
| POST | /api/game/{id}/end-turn | End current turn |
| DELETE | /api/game/{id} | Delete session |
| GET | /api/sessions | List active session IDs |

## Web Frontend (static/)

**Files:** index.html (SPA shell), style.css (dark theme), app.js (game logic)

**Key JS Functions:**
- `startGame()` — creates session, auto-starts first turn, triggers AI if needed
- `loadState()` — fetches game state, calls render()
- `render()` — updates all UI elements from state
- `selectCard(index)` / `selectAttacker(index)` — selection handlers
- `submitStartTurn()` / `submitPlay()` / `submitAttack()` / `submitEndTurn()` — actions
- `autoPlayAI()` — client-side AI turn loop
- `getMyPlayer()` — finds human player by stored name
- `renderHand()` / `renderBoard()` — card display
- `renderHiddenHand(count)` — face-down opponent hand

**CSS Theme:** Dark background (#0f0f14), gold accent (#c8a84e), faction-colored card borders:
- Illuminati: purple (#8e44ad)
- Templars: gold (#f39c12)
- Reptilians: teal (#1abc9c)

## Coding Conventions

- Python 3.12+, use type hints on all functions
- Docstrings on all public methods (Google style)
- Card IDs: `{faction}_{type_prefix}_{3-digit-number}`
- Keep engine pure Python with zero UI dependencies
- All game state serializable to JSON (no sets, no circular refs)
- Write tests for any new engine logic
- Frontend: vanilla JS (no frameworks), no build step

## Makefile Commands

| Command      | Description                          |
|--------------|--------------------------------------|
| make install | Install Python dependencies          |
| make validate| Validate all cards against schema    |
| make balance | Run balance check on all cards       |
| make lint    | Run ruff linter                      |
| make test    | Run pytest test suite (127 tests)    |
| make clean   | Clean build artifacts                |
| make help    | Show all available commands          |

## Running the Game

**CLI (two players):**
```bash
python3 -m cli/game.py
# Choose [1] Two Players
```

**CLI (vs AI):**
```bash
python3 -m cli/game.py
# Choose [2] Single Player
```

**Web (vs AI in browser):**
```bash
pip install fastapi uvicorn httpx  # web extras
python3 -m uvicorn server.app:app --port 8080
# Open http://localhost:8080
```

## Balance Philosophy

- Characters: total stats (attack + health) should roughly equal cost + 1
- Spells: direct damage should roughly equal cost
- Locations: persistent effects should cost 4+
- Abilities can justify +/- 1 stat deviation from baseline
- When in doubt, undercost slightly -- more fun to have slightly overpowered cards

## Lore & World-Building

The game draws thematic inspiration from Robert Storey's "Ancient Origins" fiction series. When generating card lore, maintain consistency with:

- Secret societies operating in shadows (Illuminati)
- Ancient orders protecting relics (Templars)
- Alien infiltration and mind control (Reptilians)

*The tone is dark, conspiratorial, and blends sci-fi with ancient mystery.

## Deck Building

Each faction has 30 unique cards pool (14 characters, 10 spells, 6 locations). Curated 30-card faction decks are defined in data/decks.json with balanced mana curves. The server/session.py loads these by card ID, validates 30-card count / single faction / max 3 copies, and falls back to auto-build from the faction pool if needed.

**Current card counts:**
| Faction | Characters | Spells | Locations | Total |
|---------|-----------|--------|-----------|-------|
| Illuminati | 14 | 10 | 6 | 30 |
| Templars | 14 | 10 | 6 | 30 |
| Reptilians | 14 | 10 | 6 | 30 |
| **Total** | **42** | **30** | **18** | **90** |

**Curated faction decks (data/decks.json):**
- Illuminati Shadow Council (20C/8S/3L) — control/disruption
- Templar Holy Host (17C/8S/5L) — defense/healing
- Reptilian Invasion Force (17C/9S/4L) — aggro/swarm

Each deck is 30 cards with max 3 copies per card. The auto-builder cycles through the faction pool taking up to 3 copies each. Mulligan system allows redrawing any number of starting hand cards once per player before turn 1.

## Game Rules Summary

- **Deck:** 30 cards, max 3 copies per card, single faction
- **Life:** 30 HP, lose at 0
- **Energy:** Starts at 1, grows by 1 per turn (max 20)
- **Board:** Max 7 characters per player
- **Hand:** Max 10 cards (overflow burns/discards)
- **Locations:** Max 1 per player (replaces previous)
- **Turn:** Start Turn (draw + gain energy) -> Play/Attack -> End Turn
- **Win:** Reduce opponent life to 0 or opponent decks out

## When You Get Stuck

- Read the design docs in `docs/design/`
- Check existing tests in `tests/` for engine API examples
- Check `docs/dev/roadmap.md` for current phase priorities
- Check `docs/dev/data-model.md` for full data schema and state structure
- The engine is in `engine/` -- read `game.py` first, then `player.py`
