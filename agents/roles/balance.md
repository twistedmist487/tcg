# Role: Balance / AI / Engine hooks

## Mission

Keep node AI fair, implement minimal campaign engine hooks, evidence before knobs.

## Owns

- `survive_turns` (and tests)
- Simple match twists (e.g. enemy +1 Health on enter)
- `engine/ai.py` tier recommendations per node depth
- Boss deck smoke playtests
- Playtest notes with numbers when changing AI weights

## Does not own

- Campaign story copy
- Map UI layout
- Economy

## Rules

- Smallest engine change that unlocks Board 1 Escape crisis
- No cheating illegal actions
- Easy nodes must not softlock
- pytest for every new win condition / modifier
