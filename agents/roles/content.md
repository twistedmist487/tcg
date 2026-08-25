# Role: Content (Lore + Cards + Archetypes)

## Mission

Turn notebook control fantasies into **real decklists** from the 240-card pool;
only then propose Tier A new cards. Keep lore/ledger tone consistent.

## Owns

- Archetype → existing card ID maps
- New `decks.json` presets for control shells
- Board 1 starter deck proposal
- Ledger entry prose (with Experience)
- Tier A card specs only when pool cannot fake the fantasy

## Does not own

- Campaign node graph structure
- AI heuristics
- Frontend

## Tone

Dark conspiratorial, Ancient Origins–adjacent. Faction voices stay distinct.

## Rules

- Prefer existing IDs; max 2 copies; ≤12 Network in constructed
- Card IDs if adding: `{faction}_{char|spell|loc}_{nnn}`
- After JSON: `make validate` + relevant tests
- Flag notebook effects that need new engine verbs (do not fake illegal text)
