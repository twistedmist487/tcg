"""
Heuristic AI opponent for Conspiracy TCG.

A rule-based agent that scores all possible actions each turn and picks
the highest-scoring one. No ML — pure priority evaluation inspired by
Hearthstone AI design.

Key design principles:
- Action space: play card, attack character, attack face, end turn
- Scoring: weighted sum of board state evaluation terms
- Faction flavor: different weights per faction for variety
- Safe: never suggests invalid actions (validated before execution)
"""

from __future__ import annotations

import math
from typing import Any

from engine.card import CardInstance
from engine.combat import can_attack_player_directly, get_valid_attack_targets
from engine.game import Game
from engine.keywords import has_taunt
from engine.models import Card
from engine.player import Player


# ---------------------------------------------------------------------------
# Faction weight presets
# ---------------------------------------------------------------------------

FACTION_WEIGHTS: dict[str, dict[str, float]] = {
    "illuminati": {
        "board_presence": 1.0,
        "card_draw": 2.0,
        "face_damage": 0.8,
        "enemy_removal": 1.5,
        "efficiency": 0.5,
        "stealth_value": 1.0,
        "taunt_value": 0.8,
    },
    "templars": {
        "board_presence": 1.2,
        "card_draw": 0.5,
        "face_damage": 0.6,
        "enemy_removal": 1.0,
        "efficiency": 1.0,
        "stealth_value": 0.3,
        "taunt_value": 1.5,
    },
    "reptilians": {
        "board_presence": 0.8,
        "card_draw": 1.0,
        "face_damage": 1.5,
        "enemy_removal": 1.2,
        "efficiency": 0.6,
        "stealth_value": 1.5,
        "taunt_value": 0.5,
    },
}


# ---------------------------------------------------------------------------
# AIPlayer configuration
# ---------------------------------------------------------------------------

class AIPlayer:
    """
    Configuration for an AI player.

    Attributes:
        name: Display name.
        faction: Faction name (illuminati, templars, reptilians).
        aggression: 0.0 (defensive) to 1.0 (aggressive).
        weights: Scoring weight dict for board evaluation.
    """

    def __init__(
        self,
        name: str = "AI",
        faction: str = "illuminati",
        aggression: float = 0.5,
    ) -> None:
        self.name = name
        self.faction = faction
        self.aggression = max(0.0, min(1.0, aggression))
        self.weights: dict[str, float] = dict(FACTION_WEIGHTS.get(faction, FACTION_WEIGHTS["illuminati"]))
        # Adjust weights based on aggression
        self.weights["face_damage"] *= 0.5 + aggression
        self.weights["taunt_value"] *= 1.5 - aggression


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def choose_action(game: Game) -> dict[str, Any]:
    """
    Pick the best action for the AI's current turn.

    Returns:
        Action dict: {"action": "play", "card_index": N}
                     {"action": "attack", "attacker_index": N, "target_index": N|Mone}
                     {"action": "end_turn"}
    """
    player = game.active_player
    opponent = game.inactive_player

    best_action: dict[str, Any] = {"action": "end_turn"}
    best_score: float = score_action(game, best_action)

    # Score all possible card plays
    for i, card in enumerate(player.hand):
        action = {"action": "play", "card_index": i}
        score = score_action(game, action)
        if score > best_score:
            best_score = score
            best_action = action

    # Score all possible attacks
    for attacker_idx, attacker in enumerate(player.board):
        if not attacker.can_attack:
            continue

        # Score attacking each valid target
        for target_idx in range(len(opponent.board)):
            action = {
                "action": "attack",
                "attacker_index": attacker_idx,
                "target_index": target_idx,
            }
            score = score_action(game, action)
            if score > best_score:
                best_score = score
                best_action = action

        # Score attacking face directly (only valid if no enemy board)
        if len(opponent.board) == 0:
            action = {
                "action": "attack",
                "attacker_index": attacker_idx,
                "target_index": None,
            }
            score = score_action(game, action)
            if score > best_score:
                best_score = score
                best_action = action

    return best_action


def execute_turn(game: Game, ai: AIPlayer | None = None) -> list[dict[str, Any]]:
    """
    Execute a full AI turn: repeatedly pick and execute actions until end turn.

    Args:
        game: The Game instance. It's the AI's turn (active_player).
        ai: Optional AIPlayer config. Uses default if None.

    Returns:
        List of action results from each action taken.
    """
    results: list[dict[str, Any]] = []
    max_actions = 50  # safety limit to prevent infinite loops

    for _ in range(max_actions):
        if game.is_over:
            break

        action = choose_action(game)

        if action["action"] == "end_turn":
            result = game.end_turn()
            results.append({"action": "end_turn", "result": result})
            break
        elif action["action"] == "play":
            result = game.play_card(action["card_index"])
            results.append({"action": "play", "result": result})
            if not result.get("success"):
                # If play failed, don't try the same thing again
                break
        elif action["action"] == "attack":
            result = game.attack(
                action["attacker_index"],
                action.get("target_index"),
            )
            results.append({"action": "attack", "result": result})
            if not result.get("success"):
                break

        if game.is_over:
            break

    return results


def score_action(game: Game, action: dict[str, Any]) -> float:
    """
    Score a hypothetical action. Higher scores are better.

    Returns -inf for invalid/unplayable actions.
    """
    player = game.active_player
    opponent = game.inactive_player

    if action["action"] == "end_turn":
        return _score_end_turn(game)
    elif action["action"] == "play":
        return _score_play_card(game, action["card_index"])
    elif action["action"] == "attack":
        return _score_attack(game, action["attacker_index"], action.get("target_index"))
    return -math.inf


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------

def _score_end_turn(game: Game) -> float:
    """Score ending the turn. Baseline — only do this when nothing better."""
    player = game.active_player
    score = 0.0

    # Penalize ending turn with unspent energy
    if player.energy > 0:
        unspent_ratio = player.energy / max(1, player.max_energy)
        score -= unspent_ratio * 3.0

    # Slight bonus for ending turn if board is strong (defensive play)
    my_power = _board_power(player)
    enemy_power = _board_power(game.inactive_player)
    if my_power > enemy_power:
        score += 0.5  # "I'm ahead, consolidate"

    return score


def _score_play_card(game: Game, card_index: int) -> float:
    """Score playing a specific card from hand."""
    player = game.active_player

    # Validate
    if card_index < 0 or card_index >= len(player.hand):
        return -math.inf

    card = player.hand[card_index]

    # Can't afford it
    if player.energy < card.cost:
        return -math.inf

    if not player.can_play_card(card):
        return -math.inf

    score = 0.0
    card_type = card.type.value if hasattr(card, "type") else ""

    # Base score: cost efficiency (playing cards is generally good)
    score += card.cost * 0.5

    if card_type == "Character":
        score += _score_character_card(game, card)
    elif card_type == "Spell":
        score += _score_spell_card(game, card)
    elif card_type == "Location":
        score += _score_location_card(game, card)

    # Efficiency bonus: prefer playing highest-cost affordable card
    affordable = [c for c in player.hand if player.can_play_card(c)]
    if affordable:
        max_cost = max(c.cost for c in affordable)
        if card.cost == max_cost:
            score += 1.0  # tiebreaker for best cost efficiency

    # Small bonus for playing any card (keeps tempo)
    score += 0.3

    return score


def _score_character_card(game: Game, card: Card) -> float:
    """Score playing a character card."""
    player = game.active_player
    score = 0.0

    # Board presence
    score += FACTION_WEIGHTS.get(player.board_size < 7 and "illuminati" or "illuminati", {}).get("board_presence", 1.0) * 2.0

    # Stats value: (attack + health) relative to cost
    if hasattr(card, "attack") and hasattr(card, "health"):
        total_stats = card.attack + card.health
        cost_efficiency = total_stats / max(1, card.cost)
        score += cost_efficiency * 1.5

    # Keyword bonuses
    ability = getattr(card, "ability", "") or ""
    if "Taunt" in ability:
        score += 2.0  # Taunt is valuable for protection
    if "Stealth" in ability:
        score += 1.5  # Stealth protects the character first turn

    # Board full check
    if len(player.board) >= Player.MAX_BOARD_SIZE:
        return -math.inf

    # Prefer playing characters early (board presence matters)
    if len(player.board) < 3:
        score += 1.0

    return score


def _score_spell_card(game: Game, card: Card) -> float:
    """Score playing a spell card."""
    score = 1.0  # Base: spells are fine

    # Prefer efficient spells (higher cost = assumed stronger effect)
    score += card.cost * 0.3

    # Bonus if enemy has a strong board (removal is valuable)
    enemy_power = _board_power(game.inactive_player)
    if enemy_power > 5:
        score += enemy_power * 0.5

    return score


def _score_location_card(game: Game, card: Card) -> float:
    """Score playing a location card."""
    player = game.active_player

    # Can only have one location
    if player.location is not None:
        return -math.inf

    # Locations are expensive but provide ongoing value
    score = 2.0 + card.cost * 0.2

    return score


def _score_attack(
    game: Game, attacker_index: int, target_index: int | None
) -> float:
    """Score a specific attack action."""
    player = game.active_player
    opponent = game.inactive_player

    # Validate attacker
    if attacker_index < 0 or attacker_index >= len(player.board):
        return -math.inf

    attacker = player.board[attacker_index]

    if not attacker.can_attack:
        return -math.inf

    score = 0.0

    if target_index is None:
        # Face attack — only valid if enemy has no board
        if len(opponent.board) > 0:
            return -math.inf

        score += attacker.current_attack * 1.0  # damage to face is good
        score += attacker.current_attack * 0.5  # aggression bonus

        # Big bonus for lethal
        if attacker.current_attack >= opponent.life:
            score += 100.0

    else:
        # Character attack
        if target_index < 0 or target_index >= len(opponent.board):
            return -math.inf

        defender = opponent.board[target_index]

        score += _score_character_attack(attacker, defender, player, opponent)

    return score


def _score_character_attack(
    attacker: CardInstance,
    defender: CardInstance,
    attacker_owner: Player,
    defender_owner: Player,
) -> float:
    """Score an attack of one character against another."""
    score = 0.0

    # Killing the enemy is the highest priority
    if attacker.current_attack >= defender.current_health:
        score += 10.0  # Big kill bonus
        # Bonus for killing high-value targets
        score += defender.current_attack * 2.0
        score += defender.current_health * 1.0

        # Prefer trades where we also die (removing threat)
        if defender.current_attack >= attacker.current_health:
            # Trading: good if our character is less valuable
            my_value = attacker.current_attack + attacker.current_health
            their_value = defender.current_attack + defender.current_health
            if their_value > my_value:
                score += 3.0  # Favorable trade
            else:
                score -= 1.0  # Unfavorable trade
    else:
        # Not a kill — value based on damage dealt
        score += attacker.current_attack * 0.3

    # Don't attack into big retaliation unless we have advantage
    if defender.current_attack >= attacker.current_health:
        # We'll die — only good if we kill them too (handled above)
        score -= 2.0

    # Prefer attacking low-health, high-attack enemies (remove threats)
    if defender.current_health <= 2:
        score += 1.5

    # Prefer not to waste stealth on bad trades
    if attacker.is_stealth and attacker.current_attack < defender.current_health:
        if defender.current_attack >= attacker.current_health:
            score -= 1.0  # Bad stealth trade

    return score


def _board_power(player: Player) -> float:
    """Estimate total board power of a player."""
    power = 0.0
    for char in player.board:
        power += char.current_attack * 1.0 + char.current_health * 0.5
        if has_taunt(char):
            power += 1.0
    # Factor in life total
    power += player.life * 0.1
    # Factor in hand size (card advantage)
    power += player.hand_size * 0.3
    return power
