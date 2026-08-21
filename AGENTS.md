# AGENTS.md -- Guide for AI Cocreators

This document is for AI coding assistants (and human contributors) working on
the Conspiracy TCG project. Read this before making changes.

## Project Overview

Conspiracy TCG is a Python-based single-player card game with three conspiracy-
themed factions. Players learn through a tutorial (Phase 8) and play against
AI. Online multiplayer, matchmaking, and human-vs-human play are out of scope.
The project is playable through Phase 8 (tutorial, vs AI, deck builder) with
Phase 9 in progress. The live pool is 240 cards (40 per faction + 120 Network).
It uses a data-driven design: all cards and factions are
defined in JSON files and loaded by Pydantic-validated models. The game engine
is pure Python with zero UI dependencies -- CLI, web UI, and AI all wrap
around the same engine.

**Tech Stack:** Python 3.12+, Pydantic 2.x, FastAPI, pytest, ruff

## Current Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Project scaffolding, tooling, git | COMPLETE |
| 1 | Pydantic data models, loaders, validation | COMPLETE |
| 2 | Game engine (Game, Player, CardInstance, Combat, Keywords) | COMPLETE |
| 3 | Card expansion (27 cards, 9 per faction) | COMPLETE |
| 4 | Heuristic AI opponent with faction weights | COMPLETE |
| 5 | FastAPI web server + browser UI | COMPLETE |
| 6 | Spell & location effect resolution engine | COMPLETE |
| 7 | Content expansion (90 cards, decks, mulligan, balance pass) | COMPLETE |
| 8 | Tutorial + single-player experience + deck builder | COMPLETE |
| 9 | Polish, Hard AI, replayability | IN PROGRESS |

**Stats:** 306 tests, 240 cards (120 faction + 120 Network), 30 Python source files, vanilla JS frontend + `static/ui/` art kit

## Directory Layout

```
agents/              AI helper agents (lore gen, balance checking)
  base_agent.py      Base class with data CRUD and JSON loading
  lore_agent.py      Generates card lore from faction data
  rules_agent.py     Evaluates card balance with stat-to-cost heuristics
cli/                 Command-line game runner
  game.py            Vs-AI text interface (two-human hotseat is leftover test code)
data/                JSON data store
  cards.json         240 game cards (40 per faction + 120 Network)
  decks.json         Curated 30-card faction decks + test/brew presets
  encounters.json    Tutorial + Keyword Lab + showcases + 3 Hard challenges
  factions.json      3 faction definitions with energy types and mechanics
docs/design/         Game design documents
  game_concept.md    Theme, USPs, core gameplay loop
  factions.md        Detailed faction lore, all card listings
  rules.md           Complete game rules, turn structure, keywords
docs/dev/            Developer reference
  data-model.md      Full card schema, engine API, game state structure
  roadmap.md         Development plan with all phases
  plans/             Implementation plans for completed phases
docs/wiki/           TCG slice of the chriswiki vault (Obsidian pages)
  README.md          How this slice relates to C:\\Users\\chris\\chriswiki
  index.md           Catalog
  SCHEMA.md          Page rules
  entities/          conspiracy-tcg, cards, UI
engine/              Game engine -- NO UI dependencies
  __init__.py        Public API exports
  models.py          Pydantic Card/Faction models and JSON loaders
  game.py            Game state, turn loop, action dispatch, win conditions
  player.py          Player state (deck, hand, board, life, energy, fatigue)
  card.py            CardInstance runtime state on the board
  combat.py          Attack/block/damage resolution, CombatResult
  keywords.py        Taunt, Stealth, Silence, Exhausted mechanics
  effects.py         Spell, location, and trigger resolution
  decks.py           Deck validation and construction
  serializer.py      Full game state save/load via JSON
  ai.py              Rule-based AI: Easy / Medium / Hard (Hard is 2-ply look-ahead)
                     (Medium/Hard score Recycle, location replace, Split, evergreen verbs)
server/              FastAPI web server
  __init__.py
  app.py             REST API endpoints + static file serving
  session.py         In-memory game session management
static/              Web frontend (no build step)
  index.html         SPA shell (menu, deck builder, Conspiracy Table)
  style.css          Dark theme + table chrome
  app.js             Game UI, API calls, Dossier, client-side AI
  cards/             Faction card front/back plates
  ui/                Table chrome (rails, energy, buttons, hero portraits)
assets/ui-table/     Authoring copy of the UI kit + preview.html
tests/               306 tests (models, engine, effects, decks, server, expansion, AI)
tools/               Utility scripts
  validate_cards.py  Card schema + new-Network balance lint
  playtest_live.py   AI-vs-AI tutorial and preset matches
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
player.max_energy # Energy cap (grows by 1 per turn, max 10)
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
| POST | /api/game/{id}/discover | Choose a Discovered card |
| POST | /api/game/{id}/recycle | Recycle a hand card (pay 1, shuffle, draw) |
| POST | /api/game/{id}/split | Choose a Split option |
| POST | /api/game/{id}/end-turn | End current turn |
| DELETE | /api/game/{id} | Delete session |
| GET | /api/sessions | List active session IDs |

## Web Frontend (static/)

**Files:** `index.html`, `style.css`, `app.js`, plus `static/cards/` plates and `static/ui/` chrome.

The match screen is the **Conspiracy Table**: history (5 lines) + Dossier + locations on the left; oval table with hero portraits and boards in the center; energy crystals, End Turn, and deck on the right; fanned hand along the bottom. Full layout and asset list: [docs/wiki/ui-and-assets.md](docs/wiki/ui-and-assets.md).

**Key JS Functions:**
- `beginMatch()` — creates a session (tutorial, vs AI, or encounter)
- `loadState()` / `render()` — fetch state and paint the table
- `selectCard(index)` / `selectAttacker(index)` — selection
- `submitStartTurn()` / `submitPlay()` / `submitAttack()` / `submitEndTurn()` — actions
- `showDossier()` / `setupDossierInteractions()` — hover/pin card inspector
- `renderEnergyWell()` / `renderDeckWell()` / `paintHeroFrame()` — right rail and heroes
- `formatRulesHtml()` — bold printed keywords in card text
- `autoPlayAI()` — client-side AI turn loop
- `renderHand()` / `renderBoard()` / `renderHiddenHand(count)` — cards

**CSS Theme:** Dark background (#0f0f14), gold accent (#c8a84e). Body type is Source Sans 3; titles use Cinzel. Faction colors:
- Illuminati: purple (#8e44ad)
- Templars: gold (#f39c12)
- Reptilians: teal (#1abc9c)

Do not bake names, costs, or rules into generated UI JPEGs. Unaffordable hand cards stay opaque (desaturate only).

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
| make test    | Run pytest test suite (306 tests)    |
| make clean   | Clean build artifacts                |
| make help    | Show all available commands          |

## Running the Game

The product is single-player vs AI. Do not add multiplayer, matchmaking,
WebSockets, or human-vs-human product features.

**Web (vs AI in browser -- intended experience):**
```bash
pip install fastapi uvicorn httpx  # web extras
python3 -m uvicorn server.app:app --port 8080
# Open http://localhost:8080
```

**CLI (vs AI):**
```bash
python3 -m cli/game.py
# Choose Single Player
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

Each faction has a 40-card identity pool (18 characters, 14 spells, 8 locations).
The Network is a 120-card shared pool (62 characters, 42 spells, 16 locations; one is a token)
any starting faction can hire. Curated 30-card decks live in data/decks.json.
Validation: 30 cards, max 2 copies, one starting faction, at most 12 Network
cards. Other factions' cards are still illegal.

**Current card counts:**
| Faction | Characters | Spells | Locations | Total |
|---------|-----------|--------|-----------|-------|
| Illuminati | 18 | 14 | 8 | 40 |
| Templars | 18 | 14 | 8 | 40 |
| Reptilians | 18 | 14 | 8 | 40 |
| The Network | 62 | 42 | 16 | 120 |
| **Total** | **116** | **84** | **32** | **240** |

**Curated faction decks (data/decks.json):**
- Illuminati Shadow Council — discard / bounce / silence + Double Agent
- Templar Holy Host — Shielding, Recur walls, heals + Relic Courier
- Reptilian Invasion Force — Rush, Venom, tokens + Skin-Walker Hireling

Play vs AI also offers test/brew presets (Charge, Walls, Denial, Swarm, Network Lab, Locks, Oath, Brood, Silence Toolbox, Recycle Engine).

The auto-builder cycles through the faction pool taking up to 2 copies each. Mulligan system allows redrawing any number of starting hand cards once per player before turn 1.

## Game Rules Summary

- **Deck:** 30 cards, max 2 copies, one starting faction, up to 12 Network cards
- **Life:** 30 HP, lose at 0
- **Energy:** Starts at 1, grows by 1 per turn (max 10)
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
- Check `docs/wiki/entities/conspiracy-tcg-ui.md` (and `C:\\Users\\chris\\chriswiki\\entities\\conspiracy-tcg-ui.md`) before changing the browser table or `static/ui/`
- The engine is in `engine/` -- read `game.py` first, then `player.py`
