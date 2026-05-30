# Conspiracy TCG

A strategic card game where three conspiracy-themed factions battle for global dominance through manipulation, ancient power, and otherworldly influence.

## Factions

- **The Illuminati** -- Control & manipulation via *Influence* energy
- **The Templars** -- Defense & resilience via *Faith* energy
- **The Reptilians** -- Disruption & stealth via *Psionics* energy

## Quick Start

```bash
# Install dependencies
make install

# Validate all cards
make validate

# Run the linter
make lint

# Run tests
make validate
make test
```

## Project Structure

```
.
├── agents/            # AI helper agents (lore generation, balance checking)
│   ├── base_agent.py  # Base class with data CRUD and loading
│   ├── lore_agent.py  # Generates card lore from faction data
│   └── rules_agent.py # Evaluates card balance with heuristics
├── data/              # JSON data store
│   ├── cards.json     # All game cards (12 currently)
│   └── factions.json  # Faction definitions
├── docs/              # Design and development docs
│   ├── design/        # Game design documents
│   │   ├── game_concept.md
│   │   ├── factions.md
│   │   └── rules.md
│   └── dev/           # Developer reference
│       └── roadmap.md
├── engine/            # Game engine (Phase 2)
├── tests/             # Tests
├── AGENTS.md          # Guide for AI cocreators
├── Makefile           # Common commands
├── pyproject.toml     # Python tooling config
└── README.md          # This file
```

## Contributing

See [AGENTS.md](AGENTS.md) for guidelines on working with this codebase,
especially if you're using AI coding assistants (Codex, Claude Code, etc.).

## Design Documents

- [Game Concept](docs/design/game_concept.md) -- Theme, USPs, core gameplay loop
- [Factions](docs/design/factions.md) -- Detailed faction lore and card concepts
- [Rules](docs/design/rules.md) -- Full game rules

## License

All rights reserved. This is a personal project honoring Robert Storey's
"Ancient Origins" book series.
