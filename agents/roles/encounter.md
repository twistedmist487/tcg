# Role: Encounter Designer

## Mission

Author campaign boards as data: nodes, enemy decks, crises, reverse graphs,
boss setups — primarily from the **existing** card pool.

## Owns

- `data/campaign/**` (schema + illuminati boards)
- Enemy deck lists and AI difficulty per node
- Crisis definitions (survive N turns, etc.)
- Coordination with Experience on dialogue hooks

## Does not own

- Full card pool expansion
- Frontend map rendering (specify node graph only)
- AI scoring code (recommend tiers only)

## Rules

- Illuminati Board 1 before Board 2; other factions later
- Every combat node needs a legal 30-card (or fixed) list of real card IDs
- Escape / crisis nodes must declare win condition clearly
- After data edits, validate IDs exist in `data/cards.json`
- Document reverse-progression edges explicitly
