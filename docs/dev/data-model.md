# Data Model -- Cards & Factions

This document defines the Conspiracy TCG data schema. JSON files in `data/`
must conform to these specifications.

## Card Types

### Character Card

Characters are deployed to the board and can attack or be attacked.
They enter play "exhausted" (summoning sickness) and can act next turn.

```json
{
  "id": "illuminati_char_001",
  "name": "Shadow Broker",
  "type": "Character",
  "faction": "illuminati",
  "cost": 3,
  "energy_type": "Influence",
  "attack": 2,
  "health": 3,
  "ability": "When played, look at opponent's hand and discard one card.",
  "lore": "A master of secrets, always trading in whispers and shadows."
}
```

Required fields: `id`, `name`, `type`, `faction`, `cost`, `energy_type`,
`attack`, `health`, `ability`, `lore`.

### Spell Card

Spells are one-time effects. Resolve the effect, then discard.

```json
{
  "id": "illuminati_spell_001",
  "name": "Media Blackout",
  "type": "Spell",
  "faction": "illuminati",
  "cost": 4,
  "energy_type": "Influence",
  "effect": "Silence all enemy characters until end of turn.",
  "lore": "Control the narrative, control the masses."
}
```

Required fields: `id`, `name`, `type`, `faction`, `cost`, `energy_type`,
`effect`, `lore`.

### Location Card

Locations persist on the board and provide ongoing effects. Limit: 1 per
player at a time.

```json
{
  "id": "illuminati_loc_001",
  "name": "Secret Society Lodge",
  "type": "Location",
  "faction": "illuminati",
  "cost": 5,
  "energy_type": "Influence",
  "effect": "All your Illuminati characters gain +1 Attack.",
  "lore": "Where plans are hatched in the dead of night."
}
```

Required fields: `id`, `name`, `type`, `faction`, `cost`, `energy_type`,
`effect`, `lore`.

## Game Keywords

| Keyword    | Description                                                  |
|------------|--------------------------------------------------------------|
| Taunt      | Enemy characters must attack this character if able          |
| Stealth    | Cannot be targeted by enemy attacks/abilities until it attacks |
| Silence    | Removes all abilities from a target until end of turn        |
| Exhausted  | Cannot attack or act; wears off at start of next turn        |

## Factions

| Faction    | Energy Type | Playstyle focus                          |
|------------|-------------|------------------------------------------|
| Illuminati | Influence   | Control, hand disruption, stealth        |
| Templars   | Faith       | Defense, healing, direct damage          |
| Reptilians | Psionics    | Debuffs, mind control, transformation    |

See `docs/design/factions.md` for detailed lore.
