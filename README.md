# Conspiracy TCG

A single-player strategic card game where three conspiracy-themed factions battle for global dominance through manipulation, ancient power, and otherworldly influence. Inspired by Hearthstone's gameplay with a dark conspiracy theme drawn from Robert Storey's "Ancient Origins" series.

Learn in a guided tutorial, then play against AI. No multiplayer, accounts, or matchmaking.

**240 cards | 3 factions + Network | Browser vs AI | Tutorial-first solo play**

## Factions

- **The Illuminati** -- Control & manipulation via *Influence* energy
- **The Templars** -- Defense & resilience via *Faith* energy
- **The Reptilians** -- Disruption & stealth via *Psionics* energy

## Quick Start

```bash
# Install dependencies
make install

# Validate cards, run linter, run all tests
make validate
make lint
make test
```

## Play the Game

### Web Browser (Recommended)
```bash
pip install fastapi uvicorn httpx  # web server dependencies
python3 -m uvicorn server.app:app --port 8080
```
Open http://localhost:8080 in your browser. Play the tutorial, fight the AI, run a faction encounter, or build a deck.

### CLI (vs AI)
```bash
python3 -m cli/game.py
# Choose Single Player
```

## How to Play

1. **Start Turn** -- Draw a card and gain energy (energy grows by 1 each turn)
2. **Play Cards** -- Spend energy to play characters, spells, or locations from your hand
3. **Attack** -- Use characters to fight enemy characters or hit the opponent directly
4. **End Turn** -- AI opponent takes its turn automatically
5. **Win** -- Reduce opponent's life from 30 to 0, or make them deck out

## Project Structure

```
.
├── agents/              # AI helper agents
│   ├── base_agent.py    # Base class with JSON data CRUD
│   ├── lore_agent.py    # Card lore generation from faction data
│   └── rules_agent.py   # Balance checking (stat-to-cost heuristics)
├── cli/                 # Command-line interface
│   └── game.py          # Vs-AI text game
├── data/                # JSON data store
│   ├── cards.json       # 240 cards (40 per faction + 120 Network)
│   ├── decks.json       # Curated 30-card faction decks
│   ├── encounters.json  # Tutorial + showcase matchups
│   └── factions.json    # 3 faction definitions
├── assets/
│   ├── card-templates/  # Faction card front/back plates
│   └── ui-table/        # Table chrome kit + preview mock
├── docs/
│   ├── design/          # Game design (rules, factions, concept)
│   ├── dev/             # Developer docs (roadmap, data model, plans)
│   └── wiki/            # Product wiki (UI layout and assets)
├── engine/              # Core game engine (zero UI dependencies)
│   ├── models.py        # Pydantic card/faction models + loaders
│   ├── game.py          # Game state, turn loop, win conditions
│   ├── player.py        # Player (deck, hand, board, life, energy)
│   ├── card.py          # CardInstance (mutable board state)
│   ├── combat.py        # Attack/damage resolution
│   ├── keywords.py      # Taunt, Stealth, Silence, Exhausted
│   ├── serializer.py    # JSON save/load of game state
│   └── ai.py            # Heuristic AI opponent
├── server/              # FastAPI web server
│   ├── app.py           # REST API + static file serving
│   └── session.py       # In-memory session management
├── static/              # Web frontend (no build step)
│   ├── index.html       # SPA shell
│   ├── style.css        # Dark theme + Conspiracy Table
│   ├── app.js           # Game UI, Dossier, client-side AI
│   ├── cards/           # Card front/back plates
│   └── ui/              # Rails, energy crystals, buttons, heroes
├── tests/               # 286 tests
│   ├── test_ai.py       # AI behavior (19 tests)
│   ├── test_card.py     # CardInstance state (23 tests)
│   ├── test_combat.py   # Combat resolution (9 tests)
│   ├── test_keywords.py # Keyword mechanics (11 tests)
│   ├── test_models.py   # Pydantic validation (18 tests)
│   ├── test_player.py   # Player state (22 tests)
│   ├── test_server.py   # FastAPI endpoints (14 tests)
│   └── test_validate_cards.py # Schema validation (11 tests)
├── tools/
│   └── validate_cards.py # Card schema validator
├── AGENTS.md            # AI cocreator guide
├── Makefile             # Common commands
├── pyproject.toml       # Python tooling config
└── README.md            # This file
```

## API Reference (for Web/AI integration)

The engine exposes a clean state dict and accepts action dicts:

```python
from engine.game import Game
from engine.models import load_cards

# Load cards and build decks
cards = load_cards("data/cards.json")
deck = [c for c in cards if c.faction.value == "illuminati"] * 3  # 30 cards

# Create game
game = Game.setup(deck1, deck2, "Alice", "Bob")

# Play
while not game.is_over:
    game.start_turn()
    result = game.play_card(0)          # Play hand card
    result = game.attack(0, None)       # Attack face
    game.end_turn()

# Get state
state = game.get_state()  # Full serializable dict
```

## Web API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/game/new` | Create game (returns session_id + state) |
| `GET /api/game/{id}/state` | Get current game state |
| `POST /api/game/{id}/start-turn` | Start turn (draw + energy) |
| `POST /api/game/{id}/play?card_index=N` | Play card from hand |
| `POST /api/game/{id}/attack` | Attack (JSON body) |
| `POST /api/game/{id}/end-turn` | End turn, switch player |
| `DELETE /api/game/{id}` | Delete session |

## Design Documents

- [Game Concept](docs/design/game_concept.md) -- Theme, USPs, gameplay loop
- [Factions](docs/design/factions.md) -- Full lore and card listings
- [Rules](docs/design/rules.md) -- Complete rules, turn structure, keywords
- [Data Model](docs/dev/data-model.md) -- Full schema, engine API, state structure
- [Roadmap](docs/dev/roadmap.md) -- Phases 0–8 complete, Phase 9 in progress
- [Wiki](docs/wiki/README.md) -- TCG slice of chriswiki (project, cards, [UI](docs/wiki/entities/conspiracy-tcg-ui.md))

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 0-2 | Scaffolding, data models, game engine | COMPLETE |
| 3 | Card expansion (27 cards) | COMPLETE |
| 4 | AI opponent | COMPLETE |
| 5 | Web UI + FastAPI server | COMPLETE |
| 6 | Spell/location effect resolution | COMPLETE |
| 7 | Content expansion (decks, mulligan, balance) | COMPLETE |
| 8 | Tutorial, solo play, deck builder | COMPLETE |
| 9 | Polish, Hard AI, replayability, 240-card pool | IN PROGRESS |

## License

All rights reserved. This is a personal project honoring Robert Storey's "Ancient Origins" book series.
