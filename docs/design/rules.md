# Conspiracy TCG - Rules Draft

Complete game rules for the Conspiracy TCG. References the 27-card pool across 3 factions.

## 1. Game Components

*   **Deck:** Each player needs a deck of 30 cards.
    *   A deck can contain a maximum of 3 copies of any given card (by ID).
    *   A deck must be associated with a single faction (Illuminati, Templars, or Reptilians).
*   **Card Types:**
    *   **Character Cards (15):** Primary units on the field. Have Attack, Health, and unique abilities. 5 per faction.
    *   **Spell Cards (6):** One-time use cards with immediate effects (damage, buffs, debuffs, draw, heal, mind control). 2 per faction.
    *   **Location Cards (6):** Persistent cards that remain on the field with ongoing effects. 2 per faction. Limit: 1 per player.
*   **Faction Energy:** Each faction uses a unique energy type:
    *   **Illuminati:** Influence
    *   **Templars:** Faith
    *   **Reptilians:** Psionics
*   **Life Points:** Each player starts with 30 Life Points.

## 2. Game Setup

1.  Each player shuffles their 30-card deck and places it face-down.
2.  Each player draws 4 cards for their starting hand.
3.  First player is determined randomly (coin flip).
4.  The player who goes first does not draw a card on their first turn (compensation for going first).

## 3. Turn Structure

Each turn consists of three phases:

### 3.1. Start Turn (mandatory, once per turn)

*   The active player draws 1 card from their deck. (Exception: first player's first turn skips this.)
*   The active player gains 1 energy (up to their current max energy cap).
*   Max energy cap increases by 1 each turn (starts at 1, max 20).
*   All exhaustion is cleared from the active player's characters (they can now attack).
*   Any "start of turn" effects from locations or abilities trigger.

### 3.2. Main Phase (unlimited actions, in any order)

The active player can perform these actions as long as they have sufficient energy and valid targets:

*   **Play a Character Card:** Pay the card's energy cost to put a Character from your hand onto the field. Characters enter "exhausted" (cannot attack this turn). Max 7 characters on board.
*   **Play a Spell Card:** Pay the card's energy cost to resolve its effect immediately, then discard it.
*   **Play a Location Card:** Pay the card's energy cost to put a Location onto the field. Replaces any existing location. Max 1 per player.
*   **Declare Attacks:** Choose an active (non-exhausted) Character you control to attack.
    *   **Target:** You may attack an enemy Character or the opponent directly (if no enemy characters on board).
    *   **Combat Resolution:**
        *   If attacking an enemy Character: Both characters deal damage equal to their Attack simultaneously. A character dies when its Health reaches 0 or below.
        *   If attacking the opponent directly: The attacker deals damage equal to its Attack to the opponent's Life Points.
    *   **After attacking:** The character becomes "exhausted" and cannot attack again until next turn.

### 3.3. End Phase

*   Resolve any "end of turn" effects (e.g., Bilderberg Estate card draw check).
*   Clear all temporary buffs/debuffs from characters.
*   Reduce silence duration timers by 1.
*   Become the inactive player. The other player starts their turn.

## 4. Card Interactions & Keywords

### 4.1. Core Stats

| Stat | Description |
|------|-------------|
| Attack | Damage dealt in combat. Can be modified by buffs/debuffs. Never goes below 0. |
| Health | Damage sustained before dying. Current health = base + health_bonus - damage_taken. |
| Cost | Energy required to play the card from hand. |

### 4.2. Keywords

| Keyword | Description | Implementation |
|---------|-------------|----------------|
| **Taunt** | Enemy characters must attack a Taunt character if able. Non-Taunt characters cannot be targeted while a Taunt is present. | `has_taunt(character)` -- checked during target selection. Stealth characters with Taunt are still untargetable. |
| **Stealth** | Cannot be targeted by enemy attacks or abilities until it attacks or its Stealth is removed. | `has_stealth(character)` -- checked during target selection. Breaks when the character attacks. |
| **Silence** | Removes all abilities from a character or location. Silenced characters lose Taunt, Stealth, and any triggered abilities. | `apply_silence(character)` -- sets `is_silenced = True`. Can be permanent or timed. |
| **Exhausted** | Cannot attack or use abilities. Newly played characters enter exhausted. Characters become exhausted after attacking. Cleared at the start of the controller's next turn. | `is_exhausted` flag on CardInstance. `clear_all_exhaustion()` at turn start. |

### 4.3. Target Selection Rules

1. If the defending player has any Taunt characters, the attacker MUST target one of them.
2. Stealth characters cannot be targeted at all (even if they have Taunt -- Stealth takes priority).
3. If no valid targets exist (all enemies have Stealth), the attacker cannot attack characters and may attack the player directly.
4. Direct attack on the player is only valid when the opponent has zero characters on board.

## 5. Win Conditions

*   **Win:** Reduce opponent's Life Points to 0 or below.
*   **Lose:** Your Life Points reach 0 or below.
*   **Deck Out:** If you cannot draw a card, you take escalating fatigue damage (1, 2, 3, 4... per failed draw). This can cause a loss.

## 6. Complete Card Pool (27 Cards)

### Illuminati (Influence) -- 9 Cards

| ID | Name | Type | Cost | ATK | HP | Ability/Effect |
|----|------|------|------|-----|----|-----------------|
| illuminati_char_001 | Shadow Broker | Character | 3 | 2 | 3 | When played, look at opponent's hand and discard one card. |
| illuminati_char_002 | Corporate Shill | Character | 2 | 1 | 4 | At the start of your turn, gain 1 Influence. |
| illuminati_char_003 | Corporate Gauntlet | Character | 5 | 4 | 4 | Enemy characters cost (1) more Influence to play. |
| illuminati_char_004 | PR Operative | Character | 2 | 2 | 2 | When this character attacks, gain 1 Influence. |
| illuminati_spell_001 | Media Blackout | Spell | 4 | - | - | Silence all enemy characters until end of turn. |
| illuminati_spell_002 | Black Budget | Spell | 3 | - | - | Draw 2 cards. Each player discards 1 card. |
| illuminati_spell_003 | Manchurian Protocol | Spell | 6 | - | - | Take control of an enemy character with 3 or less Attack. It gains +2 Attack. |
| illuminati_loc_001 | Secret Society Lodge | Location | 5 | - | - | All your Illuminati characters gain +1 Attack. |
| illuminati_loc_002 | Bilderberg Estate | Location | 6 | - | - | At end of your turn, if you control more characters than your opponent, draw a card. |

### Templars (Faith) -- 9 Cards

| ID | Name | Type | Cost | ATK | HP | Ability/Effect |
|----|------|------|------|-----|----|-----------------|
| templars_char_001 | Knight Commander | Character | 4 | 3 | 5 | Other Templar characters you control gain +1 Health. |
| templars_char_002 | Templar Guardian | Character | 2 | 1 | 6 | Taunt. |
| templars_char_003 | Exorcist | Character | 4 | 3 | 3 | Destroyed enemy characters cannot be resurrected or returned to hand. |
| templars_char_004 | Relic Keeper | Character | 3 | 2 | 4 | Taunt. When this character is damaged, deal 1 damage to a random enemy character. |
| templars_spell_001 | Divine Smite | Spell | 3 | - | - | Deal 4 damage to a target character. |
| templars_spell_002 | Holy Inquisition | Spell | 5 | - | - | Silence and deal 3 damage to an enemy character. |
| templars_spell_003 | Absolution | Spell | 1 | - | - | Restore 5 Health to your hero or a character. Draw a card. |
| templars_loc_001 | Sacred Chapel | Location | 4 | - | - | At the start of your turn, heal 1 damage from all your characters. |
| templars_loc_002 | Holy Grail Sanctum | Location | 5 | - | - | At the start of your turn, if you have a damaged character, restore 2 Health to it. |

### Reptilians (Psionics) -- 9 Cards

| ID | Name | Type | Cost | ATK | HP | Ability/Effect |
|----|------|------|------|-----|----|-----------------|
| reptilians_char_001 | Shape-Shifter Infiltrator | Character | 3 | 2 | 2 | Stealth. |
| reptilians_char_002 | Psionic Dominator | Character | 5 | 3 | 4 | When played, take control of an enemy character with 2 or less Attack until end of turn. |
| reptilians_char_003 | Xenomorph Drone | Character | 3 | 2 | 4 | When this character destroys an enemy character, gain +1/+1. |
| reptilians_char_004 | Abduction Specialist | Character | 4 | 3 | 3 | When played, return an enemy character with 3 or less Attack to its owner's hand. |
| reptilians_spell_001 | Neural Scramble | Spell | 2 | - | - | Give an enemy character -2 Attack until end of turn. |
| reptilians_spell_002 | Ancient Star Map | Spell | 3 | - | - | Deal 2 damage to all enemy characters. Draw a card. |
| reptilians_spell_003 | Orbital Strike | Spell | 7 | - | - | Deal 6 damage to an enemy character. Deal 3 damage to all other enemy characters. |
| reptilians_loc_001 | Hidden Hive | Location | 4 | - | - | Your Reptilian characters gain "When this character attacks, draw a card." |
| reptilians_loc_002 | Underground Ant Colony | Location | 5 | - | - | Your Reptilian characters gain +1 Attack. When one of your characters dies, draw a card. |

## 7. Web UI Flow

The browser-based game follows this flow:

1. **Landing Page** -- Faction selection (Illuminati/Templars/Reptilians) + player name input
2. **Game Start** -- Server creates session, auto-starts first turn. If AI goes first, it auto-plays.
3. **Player Turn:**
   - Click "Start Turn" to draw and gain energy
   - Click a card in hand to select it, click "Play Card" to play it
   - Click a character on your board to select attacker, click "Attack" to attack
   - Click "End Turn" to end your turn
4. **AI Turn** -- Automatically plays (plays cards, attacks, ends turn)
5. **Repeat** until game over

## 8. API Reference (Web Server)

Base URL: `http://localhost:8080`

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/game/new` | Query: `player_name`, `player_faction` | Create game. Returns `{session_id, state, ai_name, ai_faction}` |
| GET | `/api/game/{id}/state` | - | Full game state |
| POST | `/api/game/{id}/start-turn` | - | Start turn (draw + energy) |
| POST | `/api/game/{id}/play` | Query: `card_index` | Play card from hand |
| POST | `/api/game/{id}/attack` | JSON: `{attacker_index, target_index?}` | Declare attack |
| POST | `/api/game/{id}/end-turn` | - | End turn |
| DELETE | `/api/game/{id}` | - | Delete session |
| GET | `/api/cards` | - | All 27 card definitions |
| GET | `/api/sessions` | - | List active session IDs |

## 9. Engine API Reference (Python)

```python
from engine.game import Game
from engine.models import load_cards, load_factions
from engine.ai import AIPlayer, execute_turn

# Load data
cards = load_cards("data/cards.json")
factions = load_factions("data/factions.json")

# Build decks (30 cards, max 3 copies, single faction)
illuminati_cards = [c for c in cards if c.faction.value == "illuminati"]
deck = (illuminati_cards * 3)[:30]

# Create game
game = Game.setup(deck1, deck2, "Alice", "Bob")

# Turn loop
while not game.is_over:
    game.start_turn()
    game.play_card(0)          # Returns {"success": True, "card": "Name", ...}
    game.attack(0, None)       # Returns {"success": True, "attacker": ..., "target": ..., ...}
    game.end_turn()

# AI opponent
ai = AIPlayer(name="Bot", faction="illuminati", aggression=0.6)
execute_turn(game, ai)         # AI plays full turn

# Serialization
from engine.serializer import serialize_game, deserialize_game
json_str = serialize_game(game)
restored_game = deserialize_game(json_str)
```

## 10. Additional Rules (To Be Developed in Phase 6+)

*   **Spell Effect Resolution:** Currently spells resolve their cost but not their effects. Phase 6 implements the effect engine.
*   **Location Effects:** Currently locations are played but their ongoing effects don't trigger. Phase 6 implements location persistence.
*   **Triggered Abilities:** "When played", "on attack", "on death", "start of turn" triggers. Phase 6+.
*   **Mulligan Rules:** Redraw starting hand. Phase 7.
*   **Multiplayer Rules:** 3+ player games. Phase 7.
*   **Card Rarity:** Common/Rare/Legendary tiers. Phase 8.
