# Campaign schema (v1)

- `index.json` — chapter list
- `{chapter}/chapter.json` — meta, boards list, starter_deck_id
- `{chapter}/board_{id}.json` — nodes, ledger copy

## Node types

- `story` — panels only
- `combat` / `boss` — match
- `crisis` — match with `crisis.win = survive_turns`
- `safehouse` — non-combat, auto_continue allowed in v1

## Match fields

- `ai_deck`: `[{id, copies}]` or flat ids
- `player_deck_id`: `run` uses client run deck / starter
- `crisis`: `{win, turns, label}`
- `twist_ids` / twist labels (Board 2)
