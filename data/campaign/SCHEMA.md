# Campaign schema (v1)

- `index.json` — chapter list
- `{chapter}/chapter.json` — meta, boards list, starter_deck_id
- `{chapter}/board_{id}.json` — nodes, ledger copy

## Node types

- `story` — panels only (`story_panels`; optional `story_panels_reckless`)
- `combat` / `boss` — match
- `crisis` — match with `crisis.win = survive_turns`
- `safehouse` — non-combat; `pick_one_of` mutates the run deck

## Match fields

- `player_deck_mode`: `scripted` | `run` | `run_teach`
  - `scripted` — use node `player_deck` (City teach fights)
  - `run` — client `campaignRun.deck` (Escape, reverse, Grandmaster)
  - `run_teach` — run deck with `teach_seed_ids` moved/loaned to the front, no shuffle
- `player_deck`: flat ids when scripted
- `ai_deck`: `[{id, copies}]` or flat ids
- `crisis`: `{win, turns, label}`
- `twist` / `match_modifiers` (Board 2 reverse)
- `coach`: `recruiter` | `ops` | `silent`
- `teach_seed_ids`: card ids guaranteed on top for a teach opener

## Safehouse picks

```json
{
  "action": "add | inject | prune | skip",
  "id": "card_id or walk",
  "copies": 1,
  "trim": ["ids to cut first when adding"],
  "prune_id": "card_id",
  "skip_reverse_node": "train_bounce"
}
```

Run deck starts as `starter_deck_id` (30 cards). Adds trim back to 30. Prune may go to 29. Armory injects persist into reverse + boss. Puppet Master may skip a reverse node.
