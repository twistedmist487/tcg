# Project: Conspiracy TCG - Game Concept

## High-Level Overview

"Conspiracy TCG" is a strategic card game where players command factions vying for global dominance through manipulation, ancient power, and otherworldly influence. The game centers around powerful Character cards that form the core of a player's strategy, supported by Spells and Locations that reshape the battlefield.

Built in Python 3.12 with Pydantic-validated data models and a Hearthstone-inspired game engine. Single-player only: learn in a guided tutorial, then play against AI in the browser (CLI vs-AI is available for development).

## Theme

The game draws from conspiracy theory lore, reimagining shadowy organizations as warring factions. The tone is dark, conspiratorial, and blends sci-fi with ancient mystery. Card names, abilities, and lore reference real-world conspiracy tropes reinterpreted through the lens of Robert Storey's "Ancient Origins" fiction series -- secret societies (Illuminati), ancient knightly orders (Templars), and alien infiltration (Reptilians).

## Unique Selling Points

- **Faction-Specific Energy System:** Each faction uses a unique energy type (Influence, Faith, Psionics) that grows identically but creates distinct strategic identities through card design.
- **Character-Centric Gameplay:** Characters are the stars -- they persist on the board, accumulate damage, gain buffs, and carry keywords like Taunt and Stealth.
- **Hearthstone-Inspired Clarity:** Simultaneous damage, summoning sickness, growing mana/energy, and intuitive combat make the game easy to learn but strategically deep.
- **Tutorial-First Solo Play:** New players learn by playing a guided first match. After that, the game is faction-select vs AI, with curated decks and a later deck builder. No accounts, lobbies, or multiplayer. The browser table (history, Dossier, hero frames, energy well) is documented in [docs/wiki/entities/conspiracy-tcg-ui.md](../wiki/entities/conspiracy-tcg-ui.md).
- **Data-Driven Design:** All 240 cards are defined in JSON, validated by Pydantic, and loaded at runtime. Adding new cards requires zero code changes.
- **Extensible Engine:** The engine exposes a clean state dict and accepts action dicts. CLI, web UI, AI, and future interfaces all wrap the same core.

## Core Gameplay Loop

Players take turns:

1. **Start Turn** -- Draw 1 card, gain +1 energy (capped at 10), clear exhaustion from characters
2. **Main Phase** -- Spend energy to play cards and attack (unlimited actions):
   - **Deploy Characters** -- Place character cards onto the board (max 7)
   - **Cast Spells** -- One-time effects: damage, silence, draw, heal, mind control
   - **Establish Locations** -- Persistent effects that alter the battlefield (max 1 per player)
   - **Attack** -- Characters attack enemy characters or the opponent directly
3. **End Turn** -- Clear temporary buffs, reduce silence timers, switch active player

The primary win condition is reducing the opponent's Life Points from 30 to 0. A player also loses if they cannot draw a card (deck out -- fatigue damage escalates: 1, 2, 3...).

## Game Components

| Component | Details |
|-----------|---------|
| Deck | 30 cards, one starting faction + up to 12 Network, max 2 copies per card |
| Starting Hand | 4 cards |
| Starting Life | 30 HP |
| Energy | Starts at 1, +1 per turn, max 10 |
| Board | Max 7 characters per player |
| Hand Limit | Max 10 cards (overflow discards) |
| Locations | Max 1 per player |

## Combat System

When a character attacks:
- **Vs Enemy Character:** Both characters deal damage simultaneously (attacker's ATK to defender, defender's ATK to attacker). Characters with 0 or less health die.
- **Vs Opponent Directly:** The attacker deals its ATK as direct damage to the opponent's life. Only possible when the opponent has no characters on board.
- **After Attacking:** The character becomes "exhausted" and cannot attack again until next turn.

**Taunt Rule:** If any enemy character has Taunt, the attacker MUST target a Taunt character. Non-Taunt characters cannot be targeted.

**Stealth Rule:** A character with Stealth cannot be targeted by enemy attacks until it attacks or its Stealth is removed.

## Card Types

### Character Cards (15 total, 5 per faction)
Deployed to the board. Have Attack stats, Health, and unique abilities. Enter exhausted (cannot attack the turn they're played). Examples: Shadow Broker (hand disruption), Taunt tanks, stealth assassins.

### Spell Cards (6 total, 2 per faction)
One-time effects resolved on play, then discarded. Range from direct damage to board wipes, card draw, healing, and mind control. Examples: Divine Smite (4 damage), Orbital Strike (6+3 AOE), Black Budget (draw 2, discard 1 each).

### Location Cards (6 total, 2 per faction)
Persistent battlefield modifiers. Only 1 per player at a time -- playing a new one replaces the old. Provide ongoing passive effects. Examples: Sacred Chapel (heal 1/turn), Hidden Hive (attack-draw on hit).

## Faction Identities

### Illuminati (Influence)
Control and disruption. Excels at hand manipulation, resource denial, and stealth. Plays the long game by controlling what the opponent can do.

### Templars (Faith)
Defense and healing. High-health characters, Taunt tanks, direct damage removal, and sustained healing. Wins by outlasting the opponent.

### Reptilians (Psionics)
Aggression and disruption. Debuffs, stealth, mind control, and burst damage. Wins by destabilizing the opponent's board and rushing face damage.

## AI System

The opponent AI is a rule-based heuristic agent (`engine/ai.py`) that:
- Scores all valid actions (play card, attack, end turn) using faction-specific weights
- Evaluates board presence, damage trades, face damage, and energy efficiency
- Scales aggression per faction (Illuminati: defensive control, Templars: healing trades, Reptilians: aggressive face pressure)
- Includes configurable aggression slider (0.0 defensive to 1.0 aggressive)

- Easy fumbles plays, Medium is the greedy heuristic, Hard looks one opponent reply ahead (2-ply).

## Balance Philosophy

- **Characters:** Total stats (ATK + HP) should roughly equal Cost + 1
- **Spells:** Direct damage effects should roughly equal cost
- **Locations:** Persistent effects should cost 4+
- **Abilities:** Powerful keywords (Taunt, Stealth, card draw) justify +/- 1 stat deviation
- **Tuning bias:** Slightly undercost is preferred -- slightly overpowered cards are more fun than weak ones

Phase 7 balance pass (AI vs AI, 20 games per matchup): Templars were winning ~71% and Reptilians ~16%. Tuned Templar tank bodies down, moved Swiss Vault to 5, and gave Reptilians more mid/late impact. Abilities still justify some stat-above-curve cards (legendaries, Charge, Taunt).
