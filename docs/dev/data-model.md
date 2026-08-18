# Data Model -- Cards, Factions & Engine API

This document defines the complete data schema for Conspiracy TCG, including
card definitions, faction configuration, game state structure, and engine API.

## Card Types

All cards are validated through Pydantic models in `engine/models.py`.
JSON files in `data/` must conform to these specifications.

### Character Card

Characters are deployed to the board, can attack, and persist across turns.
They enter play "exhausted" (summoning sickness -- cannot attack the turn
they're played).

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

**Required fields:** `id`, `name`, `type`, `faction`, `cost`, `energy_type`,
`attack`, `health`, `ability`, `lore`

**ID format:** `{faction}_char_{3-digit-number}` (e.g., `illuminati_char_001`).
Network cards use `neutral_char_001` and energy type `Conspiracy`.

**Balance target:** faction characters `attack + health ≈ cost + 1`. New Network characters sit at or under `cost + 1` and pay for keywords by being smaller or adding utility (Recycle, Split, cantrips).

### Spell Card

Spells are one-time effects. The effect is applied on play, then the card is
discarded. Effects are parsed from the printed text in `engine/effects.py`.

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

**Required fields:** `id`, `name`, `type`, `faction`, `cost`, `energy_type`,
`effect`, `lore`

**ID format:** `{faction}_spell_{3-digit-number}`

### Location Card

Locations persist on the board with ongoing effects. Limited to 1 per player
at a time -- playing a new location replaces the old one.

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

**Required fields:** `id`, `name`, `type`, `faction`, `cost`, `energy_type`,
`effect`, `lore`

**ID format:** `{faction}_loc_{3-digit-number}`

## Faction Model

Defined in `data/factions.json`:

```json
{
  "illuminati": {
    "name": "The Illuminati",
    "energy_type": "Influence",
    "lore_summary": "Ancient secret society controlling world events from shadows.",
    "key_mechanics": ["Control & Manipulation", "Resource Generation", "Stealth/Infiltration"]
  }
}
```

**Energy type mapping (hardcoded in engine/models.py):**
| Faction    | Energy Type |
|------------|-------------|
| illuminati | Influence   |
| templars   | Faith       |
| reptilians | Psionics    |

## Game Keywords

| Keyword   | Description | Detection | Implementation |
|-----------|-------------|-----------|----------------|
| Taunt     | Enemy must attack this character if ability | "Taunt" in ability text | `has_taunt(character)` checks `character.has_taunt` flag |
| Stealth   | Untargetable until it attacks | "Stealth" in ability text | `has_stealth(character)` checks `character.is_stealth` flag. Breaks on attack. |
| Silence   | Abilities suppressed | Applied by effects | `is_silenced(character)` checks `character.is_silenced` flag |
| Exhausted | Cannot attack; wears off next turn | Set on play and after attack | `is_exhausted(character)` checks `character.is_exhausted` flag |

Keyword detection happens at card creation time via `create_card_instance()` in
`engine/card.py`, which scans ability/effect text for keyword strings.

## Game State Structure

Returned by `game.get_state()` -- fully JSON-serializable:

```json
{
  "turn": 3,
  "active_player": "Alice",
  "players": [
    {
      "name": "Alice",
      "life": 25,
      "energy": 3,
      "max_energy": 4,
      "hand_size": 4,
      "deck_size": 19,
      "hand": [
        {
          "name": "Shadow Broker",
          "cost": 3,
          "faction": "illuminati",
          "type": "Character",
          "lore": "A master of secrets...",
          "attack": 2,
          "health": 3,
          "ability": "When played, look at opponent's hand..."
        }
      ],
      "board": [
        {
          "id": "templars_char_002",
          "name": "Templar Guardian",
          "cost": 2,
          "faction": "templars",
          "type": "Character",
          "lore": "Stands as an impenetrable wall...",
          "ability": "Taunt (Enemy characters must attack this character if able).",
          "attack": 1,
          "health": 5,
          "alive": true,
          "exhausted": false,
          "stealth": false,
          "silenced": false,
          "taunt": true,
          "damage_taken": 1
        }
      ],
      "location": {
        "id": "templars_loc_001",
        "name": "Sacred Chapel",
        "cost": 4,
        "faction": "templars",
        "type": "Location",
        "effect": "At the start of your turn, heal 1 damage from all your characters.",
        "lore": "A place of solace and restoration."
      }
    }
  ],
  "is_over": false,
  "winner": null
}
```

### Board Card Instance Fields

| Field           | Type    | Description |
|-----------------|---------|-------------|
| id              | string  | Card definition id (for the Dossier / catalog merge) |
| name            | string  | Card display name |
| cost            | int     | Energy cost to play |
| faction         | string  | "illuminati", "templars", "reptilians", or "neutral" |
| type            | string  | "Character" on board |
| lore            | string  | Flavor text (Dossier) |
| ability         | string  | Printed ability (Dossier) |
| attack          | int     | Current attack (base + buffs - debuffs, min 0) |
| health          | int     | Current health (base + health_bonus - damage_taken) |
| alive           | bool    | True if health > 0 |
| exhausted       | bool    | Cannot attack until next turn |
| stealth         | bool    | Untargetable until attacks |
| silenced       | bool    | Abilities suppressed |
| taunt           | bool    | Must be attacked first |
| damage_taken    | int     | Accumulated damage this game |

### Hand Card Fields

| Field     | Type   | Description                     |
|-----------|--------|---------------------------------|
| name      | string | Card display name               |
| cost      | int    | Energy cost to play             |
| faction   | string | Faction identifier              |
| type      | string | "Character", "Spell", "Location"|
| lore      | string | Flavor text                     |
| attack    | int*   | Base attack (Characters only)   |
| health    | int*   | Base health (Characters only)   |
| ability   | string*| Ability text (Characters only)  |
| effect    | string*| Effect text (Spells, Locations) |

## Engine API

### Loading Data

```python
from engine.models import load_cards, load_factions
cards = load_cards("data/cards.json")       # Returns list[Card]
factions = load_factions("data/factions.json")  # Returns dict[str, Faction]
```

### Creating a Game

```python
from engine.game import Game

game = Game.setup(deck1, deck2, "Alice", "Bob")
# deck1, deck2: list[Card] (30 cards each)
# First player chosen randomly
```

### Turn Loop

```python
while not game.is_over:
    game.start_turn()          # Draw, gain energy, clear exhaustion

    # Play cards (returns action result dict)
    result = game.play_card(card_index)
    # {"success": True, "action": "play_character", "card": "Name", "instance_id": "..."}

    # Attack (returns combat result dict)
    result = game.attack(attacker_index, target_index)
    # target_index=None attacks face; int attacks enemy board[target_index]
    # {"success": True, "attacker": "...", "target": "...", "damage_dealt": N, ...}

    game.end_turn()            # Cleanup, switch player
```

### Player State

```python
player = game.active_player
player.hand           # list[Card] -- cards in hand
player.board          # list[CardInstance] -- characters on board
player.deck           # list[Card] -- remaining deck
player.life           # int -- current life (starts 30)
player.energy         # int -- current available energy
player.max_energy     # int -- energy cap (grows per turn, max 10)
player.location       # CardInstance | None -- active location
player.hand_size      # int -- len(hand)
player.deck_size      # int -- len(deck)
player.board_size     # int -- len(board)

player.draw_card()                    # Draw top card, returns Card | None
player.play_card(card)                # Play from hand, returns CardInstance | None
player.can_play_card(card)            # Check if energy >= card.cost
player.spend_energy(amount)           # Returns True if affordable
player.remove_dead_characters()       # Returns list of dead CardInstances
player.direct_damage(amount)          # Deal damage to life total
```

### CardInstance (Board State)

```python
char = player.board[0]
char.card             # The underlying Card definition
char.instance_id      # Unique runtime ID (e.g. "Alice_3")
char.owner            # Player name
char.current_attack   # Base attack + buffs - debuffs (>= 0)
char.current_health   # Base health + health_bonus - damage_taken
char.is_alive         # True if current_health > 0
char.can_attack       # Not exhausted AND attack > 0 AND alive
char.is_exhausted     # Can't attack this turn
char.is_stealth       # Untargetable
char.is_silenced      # No abilities
char.has_taunt        # Must be attacked first
char.damage_taken     # Total damage accumulated

char.take_damage(amount)       # Add damage, returns actual damage
char.heal(amount)              # Reduce damage_taken, returns healed
char.modify_attack(delta)      # Adjust attack bonus
char.modify_health(delta)      # Adjust health bonus
char.mark_for_combat()         # Set exhausted = True
char.remove_stealth()          # Set stealth = False
char.silence()                 # Set silenced = True
char.clear_temp_buffs()         # Reset attack_bonus, health_bonus, buffs
```

### Combat

```python
from engine.combat import resolve_attack, get_valid_attack_targets

# Resolve a single attack
result = resolve_attack(attacker, attacker_owner, defender_owner, defender)
# result.damage_dealt_to_defender
# result.damage_dealt_to_attacker
# result.attacker_died
# result.defender_dead

# Get valid targets (respects Taunt + Stealth)
targets = get_valid_attack_targets(attacker_owner, defender_owner)
can_hit_face = attacker_owner.board and not any(
    c for c in defender_owner.board if not c.is_stealth
)
```

### Serialization

```python
from engine.serializer import serialize_game, deserialize_game

# Save
json_str = serialize_game(game, indent=2)

# Load
restored_game = deserialize_game(json_str)
```

### AI

```python
from engine.ai import AIPlayer, choose_action, execute_turn

# Create AI with faction flavor
ai = AIPlayer(name="Bot", faction="reptilians", aggression=0.7)

# Get best action
action = choose_action(game)
# Returns: {"action": "play", "card_index": N}
#          {"action": "attack", "attacker_index": N, "target_index": N|None}
#          {"action": "end_turn"}

# Execute full turn
results = execute_turn(game, ai)
# Returns list of action result dicts
```

## Web Session State

Managed by `server/session.py`:

```python
from server.session import create_session, get_session, delete_session

sid = create_session("Chris", "illuminati", "templars", "AI")
game = get_session(sid)    # Returns Game instance
delete_session(sid)
```

Session IDs are 8-character UUID prefixes. Sessions are ephemeral (lost on
server restart).

The browser table that consumes this state is documented in
[Play table UI](../wiki/entities/conspiracy-tcg-ui.md).
