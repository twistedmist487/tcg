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
import random
from typing import Any

from engine.card import CardInstance, prefix_keywords
from engine.combat import can_attack_player_directly
from engine.game import Game
from engine.keywords import get_valid_attack_targets, has_taunt
from engine.models import Card
from engine.player import Player

DIFFICULTY_PRESETS: dict[str, dict[str, float]] = {
    # Easy never skips attacks; Recruiter must poke face so First Contact cannot stall.
    "easy": {
        "aggression": 0.2,
        "mistake_chance": 0.4,
        "skip_attack_chance": 0.0,
        "poke_face": 1.0,
    },
    "medium": {
        "aggression": 0.5,
        "mistake_chance": 0.0,
        "skip_attack_chance": 0.0,
        "poke_face": 0.35,
    },
}

MAX_RECYCLES_PER_TURN = 2

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
        difficulty: \"easy\" or \"medium\". Easy plays more conservatively
            and occasionally takes a weaker action (tutorial opponent).
        weights: Scoring weight dict for board evaluation.
    """

    def __init__(
        self,
        name: str = \"AI\",
        faction: str = \"illuminati\",
        aggression: float | None = None,
        difficulty: str = \"medium\",
    ) -> None:
        self.name = name
        self.faction = faction
        self.difficulty = difficulty if difficulty in DIFFICULTY_PRESETS else \"medium\"
        preset = DIFFICULTY_PRESETS[self.difficulty]
        self.aggression = max(0.0, min(1.0, preset[\"aggression\"] if aggression is None else aggression))
        self.mistake_chance = float(preset[\"mistake_chance\"])
        self.skip_attack_chance = float(preset[\"skip_attack_chance\"])
        self.poke_face = float(preset.get(\"poke_face\", 0.35))
        self.weights: dict[str, float] = dict(
            FACTION_WEIGHTS.get(faction, FACTION_WEIGHTS[\"illuminati\"])
        )
        # Adjust weights based on aggression
        self.weights[\"face_damage\"] *= 0.5 + self.aggression
        self.weights[\"taunt_value\"] *= 1.5 - self.aggression


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def choose_action(game: Game, ai: AIPlayer | None = None) -> dict[str, Any]:
    """
    Pick the best action for the AI's current turn.

    Returns:
        Action dict: {\"action\": \"play\", \"card_index\": N}
                     {\"action\": \"attack\", \"attacker_index\": N, \"target_index\": N|None}
                     {\"action\": \"end_turn\"}
    """
    player = game.active_player
    opponent = game.inactive_player

    candidates: list[tuple[float, dict[str, Any]]] = []

    end_action: dict[str, Any] = {\"action\": \"end_turn\"}
    candidates.append((score_action(game, end_action, ai), end_action))

    recycles_used = int(getattr(game, \"_ai_recycles_this_turn\", 0))
    if recycles_used < MAX_RECYCLES_PER_TURN:
        for i, card in enumerate(player.hand):
            action = {\"action\": \"recycle\", \"card_index\": i}
            score = score_action(game, action, ai)
            if score > -math.inf:
                candidates.append((score, action))

    # Score all possible card plays
    for i, _card in enumerate(player.hand):
        action = {\"action\": \"play\", \"card_index\": i}
        score = score_action(game, action, ai)
        if score > -math.inf:
            candidates.append((score, action))

    skip_attacks = bool(ai and random.random() < ai.skip_attack_chance)

    # Score all possible attacks
    if not skip_attacks:
        for attacker_idx, attacker in enumerate(player.board):
            if not attacker.can_attack:
                continue

            # Score attacking each valid target
            for target_idx in range(len(opponent.board)):
                action = {
                    \"action\": \"attack\",
                    \"attacker_index\": attacker_idx,
                    \"target_index\": target_idx,
                }
                score = score_action(game, action, ai)
                if score > -math.inf:
                    candidates.append((score, action))

            # Face is legal when no targetable enemies (empty or Stealth-only).
            if not getattr(attacker, \"rush_locked\", False) and can_attack_player_directly(player, opponent):
                action = {
                    \"action\": \"attack\",
                    \"attacker_index\": attacker_idx,
                    \"target_index\": None,
                }
                score = score_action(game, action, ai)
                if score > -math.inf:
                    candidates.append((score, action))

    candidates.sort(key=lambda item: item[0], reverse=True)
    best_action = candidates[0][1]

    if ai and ai.mistake_chance > 0 and len(candidates) > 1 and random.random() < ai.mistake_chance:
        # Easy AI: sometimes take the second-best legal action
        best_action = candidates[1][1]

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
    game._ai_recycles_this_turn = 0

    for _ in range(max_actions):
        if game.is_over:
            break

        if getattr(game, \"pending_discovery\", None):
            pick = _best_discovery_index(game)
            result = game.choose_discovery(pick)
            results.append({\"action\": \"discover\", \"result\": result})
            continue

        if getattr(game, \"pending_split\", None):
            pick, target = _best_split_choice(game)
            result = game.choose_split(pick, target_index=target)
            results.append({\"action\": \"split\", \"result\": result})
            continue

        action = choose_action(game, ai)

        if action[\"action\"] == \"end_turn\":
            result = game.end_turn()
            results.append({\"action\": \"end_turn\", \"result\": result})
            break
        elif action[\"action\"] == \"recycle\":
            result = game.recycle(action[\"card_index\"])
            results.append({\"action\": \"recycle\", \"result\": result})
            if result.get(\"success\"):
                game._ai_recycles_this_turn = int(getattr(game, \"_ai_recycles_this_turn\", 0)) + 1
            else:
                result = game.end_turn()
                results.append({\"action\": \"end_turn\", \"result\": result})
                break
        elif action[\"action\"] == \"play\":
            card = game.active_player.hand[action[\"card_index\"]]
            text = f\"{getattr(card, 'ability', '')} {getattr(card, 'effect', '')}\".lower()
            if \"friendly\" in text:
                target = 0 if game.active_player.board else None
                result = game.play_card(
                    action[\"card_index\"],
                    spell_target_index=target,
                    target_side=\"ally\",
                )
            else:
                target = action.get(\"target_index\")
                if target is None and game.inactive_player.board:
                    target = 0
                result = game.play_card(action[\"card_index\"], spell_target_index=target)
            results.append({\"action\": \"play\", \"result\": result})
            if not result.get(\"success\"):
                result = game.end_turn()
                results.append({\"action\": \"end_turn\", \"result\": result})
                break
        elif action[\"action\"] == \"attack\":
            result = game.attack(
                action[\"attacker_index\"],
                action.get(\"target_index\"),
            )
            results.append({\"action\": \"attack\", \"result\": result})
            if not result.get(\"success\"):
                result = game.end_turn()
                results.append({\"action\": \"end_turn\", \"result\": result})
                break

        if game.is_over:
            break
    else:
        if not game.is_over:
            result = game.end_turn()
            results.append({\"action\": \"end_turn\", \"result\": result})

    return results


def score_action(game: Game, action: dict[str, Any], ai: AIPlayer | None = None) -> float:
    """
    Score a hypothetical action. Higher scores are better.

    Returns -inf for invalid/unplayable actions.
    """
    if action[\"action\"] == \"end_turn\":
        return _score_end_turn(game)
    elif action[\"action\"] == \"play\":
        return _score_play_card(game, action[\"card_index\"])
    elif action[\"action\"] == \"recycle\":
        return _score_recycle(game, action[\"card_index\"])
    elif action[\"action\"] == \"attack\":
        return _score_attack(game, action[\"attacker_index\"], action.get(\"target_index\"), ai)
    return -math.inf


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------


def _score_end_turn(game: Game) -> float:
    \"\"\"Score ending the turn. Baseline — only do this when nothing better.\"\"\"
    player = game.active_player
    score = 0.0

    if player.energy > 0:
        unspent_ratio = player.energy / max(1, player.max_energy)
        score -= unspent_ratio * 3.0

    my_power = _board_power(player)
    enemy_power = _board_power(game.inactive_player)
    if my_power > enemy_power:
        score += 0.5

    return score


def _score_play_card(game: Game, card_index: int) -> float:
    \"\"\"Score playing a specific card from hand.\"\"\"
    player = game.active_player

    if card_index < 0 or card_index >= len(player.hand):
        return -math.inf

    card = player.hand[card_index]

    if player.energy < card.cost:
        return -math.inf

    if not player.can_play_card(card):
        return -math.inf

    score = 0.0
    card_type = card.type.value if hasattr(card, \"type\") else \"\"

    score += card.cost * 0.5

    from engine.effects import effect_requires_board_target

    text = getattr(card, \"ability\", \"\") or getattr(card, \"effect\", \"\") or \"\"
    if \"friendly\" in text.lower() and not player.board:
        return -math.inf
    if effect_requires_board_target(text) and \"friendly\" not in text.lower() and not game.inactive_player.board:
        return -math.inf

    if card_type == \"Character\":
        score += _score_character_card(game, card)
    elif card_type == \"Spell\":
        score += _score_spell_card(game, card)
    elif card_type == \"Location\":
        score += _score_location_card(game, card)

    affordable = [c for c in player.hand if player.can_play_card(c)]
    if affordable:
        max_cost = max(c.cost for c in affordable)
        if card.cost == max_cost:
            score += 1.0

    score += 0.3
    score += _keyword_play_bonus(game, card, text)

    return score


def _score_character_card(game: Game, card: Card) -> float:
    \"\"\"Score playing a character card.\"\"\"
    player = game.active_player
    score = 0.0

    score += (
        FACTION_WEIGHTS.get(player.board_size < 7 and \"illuminati\" or \"illuminati\", {}).get(
            \"board_presence\", 1.0
        )
        * 2.0
    )

    if hasattr(card, \"attack\") and hasattr(card, \"health\"):
        total_stats = card.attack + card.health
        cost_efficiency = total_stats / max(1, card.cost)
        score += cost_efficiency * 1.5

    ability = getattr(card, \"ability\", \"\") or \"\"
    if \"Taunt\" in ability:
        score += 2.0
    if \"Stealth\" in ability:
        score += 1.5

    if len(player.board) >= Player.MAX_BOARD_SIZE:
        return -math.inf

    if len(player.board) < 3:
        score += 1.0

    return score


def _score_spell_card(game: Game, card: Card) -> float:
    \"\"\"Score playing a spell card.\"\"\"
    score = 1.0

    score += card.cost * 0.3

    enemy_power = _board_power(game.inactive_player)
    if enemy_power > 5:
        score += enemy_power * 0.5

    return score


def _score_location_card(game: Game, card: Card) -> float:
    \"\"\"Score playing a location card.\"\"\"
    player = game.active_player

    if player.location is not None:
        return -math.inf

    score = 2.0 + card.cost * 0.2

    return score


def _score_attack(
    game: Game, attacker_index: int, target_index: int | None, ai: AIPlayer | None = None
) -> float:
    \"\"\"Score a specific attack action.\"\"\"
    player = game.active_player
    opponent = game.inactive_player

    if attacker_index < 0 or attacker_index >= len(player.board):
        return -math.inf

    attacker = player.board[attacker_index]

    if not attacker.can_attack:
        return -math.inf

    score = 0.0

    valid_targets = get_valid_attack_targets(player, opponent)

    if target_index is None:
        if not can_attack_player_directly(player, opponent):
            return -math.inf

        poke = ai.poke_face if ai is not None else 0.35
        score += attacker.current_attack * (1.0 + poke)
        printed = getattr(attacker.card, \"ability\", \"\") or \"\"
        if \"Drain\" in prefix_keywords(printed):
            score += attacker.current_attack * 0.4

        if attacker.current_attack >= opponent.life:
            score += 100.0

    else:
        if target_index < 0 or target_index >= len(opponent.board):
            return -math.inf

        defender = opponent.board[target_index]
        if defender not in valid_targets:
            return -math.inf

        score += _score_character_attack(attacker, defender, player, opponent)

    return score


def _score_character_attack(
    attacker: CardInstance,
    defender: CardInstance,
    attacker_owner: Player,
    defender_owner: Player,
) -> float:
    \"\"\"Score an attack of one character against another.\"\"\"
    score = 0.0

    if attacker.current_attack >= defender.current_health:
        score += 10.0
        score += defender.current_attack * 2.0
        score += defender.current_health * 1.0

        if defender.current_attack >= attacker.current_health:
            my_value = attacker.current_attack + attacker.current_health
            their_value = defender.current_attack + defender.current_health
            if their_value > my_value:
                score += 3.0
            else:
                score -= 1.0
    else:
        score += attacker.current_attack * 0.3

    if defender.current_attack >= attacker.current_health:
        score -= 2.0

    if defender.current_health <= 2:
        score += 1.5

    if (
        attacker.is_stealth
        and attacker.current_attack < defender.current_health
        and defender.current_attack >= attacker.current_health
    ):
        score -= 1.0

    return score


def _board_power(player: Player) -> float:
    \"\"\"Estimate total board power of a player.\"\"\"
    power = 0.0
    for char in player.board:
        power += char.current_attack * 1.0 + char.current_health * 0.5
        if has_taunt(char):
            power += 1.0
    power += player.life * 0.1
    power += player.hand_size * 0.3
    return power


def _card_text(card: Any) -> str:
    return f\"{getattr(card, 'ability', '') or ''} {getattr(card, 'effect', '') or ''}\"


def _score_recycle(game: Game, card_index: int) -> float:
    \"\"\"Recycle is a 1-energy cycle. Prefer it on expensive late cards when energy is tight.\"\"\"
    player = game.active_player
    if card_index < 0 or card_index >= len(player.hand):
        return -math.inf
    card = player.hand[card_index]
    text = _card_text(card)
    if \"Recycle\" not in prefix_keywords(text):
        return -math.inf
    if player.energy < 1:
        return -math.inf
    if player.energy >= card.cost and card.cost <= player.energy:
        score = 0.4
    else:
        score = 2.2
    if player.hand_size <= 2:
        score -= 0.8
    if player.energy <= 1 and any(
        getattr(c, \"cost\", 99) <= player.energy and c is not card for c in player.hand
    ):
        score -= 1.5
    return score


def _keyword_play_bonus(game: Game, card: Card, text: str) -> float:
    bonus = 0.0
    keys = prefix_keywords(text)
    if \"Split\" in keys or \"Split:\" in text:
        bonus += 1.2
    if \"Drain\" in keys:
        bonus += 0.8
    if \"Ward\" in keys:
        bonus += 0.7
    if \"Discovery\" in text or \"Discover\" in text:
        bonus += 1.0
    if \"Deathrattle\" in text:
        bonus += 0.6
    return bonus


def _best_discovery_index(game: Game) -> int:
    options = game.pending_discovery[\"cards\"]
    if not options:
        return 0

    def value(card: Any) -> float:
        stats = 0.0
        if hasattr(card, \"attack\") and hasattr(card, \"health\"):
            stats = float(card.attack + card.health)
        return card.cost * 1.5 + stats + _keyword_play_bonus(game, card, _card_text(card))

    return max(range(len(options)), key=lambda i: value(options[i]))


def _best_split_choice(game: Game) -> tuple[int, int | None]:
    options = game.pending_split[\"options\"]
    opponent = game.inactive_player
    target = 0 if opponent.board else None
    best_i = 0
    best = -math.inf
    for i, text in enumerate(options):
        score = 0.5
        low = text.lower()
        if \"damage\" in low:
            score += 3.0 if opponent.board else 0.2
        if \"draw\" in low:
            score += 1.4
        if \"heal\" in low or \"restore\" in low:
            score += 1.0 if game.active_player.life < 20 else 0.2
        if score > best:
            best = score
            best_i = i
    return best_i, target
