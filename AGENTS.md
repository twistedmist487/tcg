# AGENTS.md -- Guide for AI Cocreators

This document is for AI coding assistants (and human contributors) working on
the Conspiracy TCG project. Read this before making changes.

## Project Overview

Conspiracy TCG is a Python-based strategic card game with three conspiracy-
themed factions. The project is in active development moving toward a playable
prototype. It uses a data-driven design: all cards and factions are defined in
JSON files and loaded by Python agents.

## Directory Layout

```
agents/         Python agents for lore gen and balance checking
  base_agent.py -- Base class. All agents inherit from BaseAgent.
  lore_agent.py  -- Generates card lore text from faction docs.
  rules_agent.py -- Balance-checks cards (stats vs cost heuristics).
data/           JSON data store (cards.json, factions.json)
docs/design/    Game design documents (rules, factions, concept)
docs/dev/       Developer docs (roadmap, data model, balance log)
engine/         Game engine -- core logic, turn resolution, combat
tests/          Unit and integration tests
```

## Data Model

### Card (in cards.json)

Every card is a JSON object with these fields:

| Field        | Type   | Required | Description                          |
|--------------|--------|----------|--------------------------------------|
| id           | string | Yes      | Unique ID, format: `{faction}_{type}_{nnn}` |
| name         | string | Yes      | Display name                         |
| type         | string | Yes      | One of: Character, Spell, Location   |
| faction      | string | Yes      | One of: illuminati, templars, reptilians |
| cost         | int    | Yes      | Energy cost to play (0+)             |
| energy_type  | string | Yes      | Influence, Faith, or Psionics        |
| attack       | int    | For Char | Attack power (0+)                    |
| health       | int    | For Char | Health points (1+)                   |
| ability      | string | For Char | Ability text                         |
| effect       | string | For Spell/Location | Effect text               |
| lore         | string | Yes      | Flavor text                          |

### Adding a New Card

1. Pick a unique ID following the naming convention
2. Add the card object to the array in `data/cards.json`
3. Validate: `make validate`
4. Balance-check: `make balance`
5. Run tests: `make test`
6. Commit with message: `cards: add {card name} ({faction} {type})`

### Adding a New Faction

1. Add to `data/factions.json` with name, energy_type, lore_summary, key_mechanics
2. Add a detailed faction entry in `docs/design/factions.md`
3. Create initial cards for the faction (at least 4)
4. Update this doc's faction table

## Coding Conventions

- Python 3.12+, use type hints on all functions
- Docstrings on all public methods (Google style)
- Card IDs: `{faction}_{type_prefix}_{3-digit-number}` (e.g., `illuminati_char_001`)
- Keep the engine pure Python with no UI dependencies
- All game state should be serializable to JSON
- Write tests for any new engine logic

## Makefile Commands

| Command      | Description                          |
|--------------|--------------------------------------|
| make install | Install Python dependencies          |
| make validate| Validate all cards against schema    |
| make balance | Run balance check on all cards       |
| make lint    | Run ruff linter                      |
| make test    | Run pytest test suite                |
| make run     | Run the CLI game (when available)    |
| make help    | Show all available commands          |

## Engine Design Notes (for Phase 2+)

The game engine lives in `engine/` and is organized as:

```
engine/
  __init__.py    # Public API
  game.py        # Game state, turn loop
  player.py      # Player state (hand, deck, board, life, energy)
  card_runtime.py# Card instance on the board (mutable state)
  combat.py      # Attack/block/damage resolution
  keywords.py    # Taunt, Stealth, Silence implementations
  serializer.py  # JSON serialization/deserialization of game state
```

Design principle: the engine has zero knowledge of any UI. It exposes a
state dict and accepts action dicts. The CLI, web UI, or any other interface
wraps around this.

## Lore & World-Building

The game draws thematic inspiration from Robert Storey's "Ancient Origins"
fiction series. When generating card lore, maintain consistency with:

- Secret societies operating in shadows (Illuminati)
- Ancient orders protecting relics (Templars)
- Alien infiltration and mind control (Reptilians)

The tone is dark, conspiratorial, and blends sci-fi with ancient mystery.

## Balance Philosophy

- Characters: total stats (attack + health) should roughly equal cost + 1
- Spells: direct damage should roughly equal cost
- Locations: persistent effects should cost 4+
- Abilities can justify +/- 1 stat deviation from baseline
- When in doubt, undercost slightly -- it's more fun to have slightly
  overpowered cards than boring weak ones

## When You Get Stuck

- Read the design docs in `docs/design/`
- Check existing tests in `tests/` for examples
- Check `docs/dev/roadmap.md` for current phase priorities
