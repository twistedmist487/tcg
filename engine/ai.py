"""
Heuristic AI opponent for Conspiracy TCG.

A rule-based agent that scores all possible actions each turn and picks
the highest-scoring one. No ML — pure priority evaluation inspired by
Hearthstone AI design.

Key design principles:
- Action space: play card, recycle, attack character, attack face, end turn
- Scoring: weighted sum of board state evaluation terms
- Faction flavor: different weights per faction for variety
- Safe: never suggests invalid actions (validated before execution)
"""

from __future__ import annotations

import copy
import math
import random
import re
from typing import Any

from engine.card import CardInstance, prefix_keywords
from engine.combat import can_attack_player_directly
from engine.game import Game
from engine.hero_power import power_for
from engine.keywords import get_valid_attack_targets, has_taunt, has_stealth
from engine.models import Card
from engine.player import Player

DIFFICULTY_PRESETS: dict[str, dict[str, float]] = {
    # Easy still fumbles plays, but always considers attacks and prefers face
    # so a stalled board cannot last forever (tutorial Recruiter included).
    "easy": {
        "aggression": 0.35,
        "mistake_chance": 0.25,
        "skip_attack_chance": 0.0,
        "poke_face": 1.0,
    },
    "medium": {
        "aggression": 0.5,
        "mistake_chance": 0.0,
        "skip_attack_chance": 0.0,
        "poke_face": 0.0,
    },
    "hard": {
        "aggression": 0.65,
        "mistake_chance": 0.0,
        "skip_attack_chance": 0.0,
        "poke_face": 0.0,
    },
}

HARD_CANDIDATE_CAP = 6

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
        difficulty: "easy", "medium", or "hard". Easy fumbles plays.
            Medium is a greedy heuristic. Hard looks one opponent reply ahead.
        weights: Scoring weight dict for board evaluation.
    """

    def __init__(
        self,
        name: str = "AI",
        faction: str = "illuminati",
        aggression: float | None = None,
        difficulty: str = "medium",
    ) -> None:
        self.name = name
        self.faction = faction
        self.difficulty = difficulty if difficulty in DIFFICULTY_PRESETS else "medium"
        preset = DIFFICULTY_PRESETS[self.difficulty]
        self.aggression = max(0.0, min(1.0, preset["aggression"] if aggression is None else aggression))
        self.mistake_chance = float(preset["mistake_chance"])
        self.skip_attack_chance = float(preset["skip_attack_chance"])
        self.poke_face = float(preset.get("poke_face", 0.0))
        self._in_lookahead = False
        self.weights: dict[str, float] = dict(
            FACTION_WEIGHTS.get(faction, FACTION_WEIGHTS["illuminati"])
        )
        # Adjust weights based on aggression
        self.weights["face_damage"] *= 0.5 + self.aggression
        self.weights["taunt_value"] *= 1.5 - self.aggression


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def choose_action(game: Game, ai: AIPlayer | None = None) -> dict[str, Any]:
    """
    Pick the best action for the AI's current turn.

    Returns:
        Action dict: {"action": "play", "card_index": N}
                     {"action": "recycle", "card_index": N}
                     {"action": "attack", "attacker_index": N, "target_index": N|None}
                     {"action": "end_turn"}
    """
    player = game.active_player
    opponent = game.inactive_player

    candidates: list[tuple[float, dict[str, Any]]] = []

    end_action: dict[str, Any] = {"action": "end_turn"}
    candidates.append((score_action(game, end_action, ai), end_action))

    for i, _card in enumerate(player.hand):
        action = {"action": "play", "card_index": i}
        score = score_action(game, action, ai)
        if score > -math.inf:
            candidates.append((score, action))
        recycle_action = {"action": "recycle", "card_index": i}
        recycle_score = score_action(game, recycle_action, ai)
        if recycle_score > -math.inf:
            candidates.append((recycle_score, recycle_action))

    skip_attacks = bool(ai and random.random() < ai.skip_attack_chance)

    if not (ai and ai.difficulty == "easy"):
        for power_action in _hero_power_candidates(game):
            score = score_action(game, power_action, ai)
            if score > -math.inf:
                candidates.append((score, power_action))

    if not skip_attacks:
        for attacker_idx, attacker in enumerate(player.board):
            if not attacker.can_attack:
                continue

            for target_idx in range(len(opponent.board)):
                action = {
                    "action": "attack",
                    "attacker_index": attacker_idx,
                    "target_index": target_idx,
                }
                score = score_action(game, action, ai)
                if score > -math.inf:
                    candidates.append((score, action))

            if not getattr(attacker, "rush_locked", False) and can_attack_player_directly(
                player, opponent
            ):
                action = {
                    "action": "attack",
                    "attacker_index": attacker_idx,
                    "target_index": None,
                }
                score = score_action(game, action, ai)
                if score > -math.inf:
                    candidates.append((score, action))

    candidates.sort(key=lambda item: item[0], reverse=True)
    best_action = candidates[0][1]

    if ai and ai.difficulty == "hard" and not getattr(ai, "_in_lookahead", False):
        return _pick_with_lookahead(game, ai, candidates)

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
    recycles = 0

    for _ in range(max_actions):
        if game.is_over:
            break

        if getattr(game, "pending_discovery", None):
            pick = _best_discovery_index(game)
            result = game.choose_discovery(pick)
            results.append({"action": "discover", "result": result})
            continue

        if getattr(game, "pending_split", None):
            pick, target = _best_split_choice(game)
            result = game.choose_split(pick, target_index=target)
            results.append({"action": "split", "result": result})
            continue

        action = choose_action(game, ai)
        if action["action"] == "recycle" and recycles >= 2:
            action = {"action": "end_turn"}
        result = _perform_action(game, action)
        results.append({"action": action["action"], "result": result})

        if action["action"] == "end_turn":
            break
        if action["action"] == "recycle" and result.get("success"):
            recycles += 1
        if not result.get("success"):
            if not game.is_over and game.turn_started:
                end = game.end_turn()
                results.append({"action": "end_turn", "result": end})
            break

        if game.is_over:
            break
    else:
        if not game.is_over:
            result = game.end_turn()
            results.append({"action": "end_turn", "result": result})

    return results


def _perform_action(game: Game, action: dict[str, Any]) -> dict[str, Any]:
    """Apply one chosen action on a live game. Does not loop."""
    kind = action.get("action")
    if kind == "end_turn":
        return game.end_turn()
    if kind == "recycle":
        return game.recycle(action["card_index"])
    if kind == "play":
        card = game.active_player.hand[action["card_index"]]
        text = f"{getattr(card, 'ability', '')} {getattr(card, 'effect', '')}".lower()
        if "friendly" in text:
            target = 0 if game.active_player.board else None
            return game.play_card(
                action["card_index"],
                spell_target_index=target,
                target_side="ally",
            )
        target = action.get("target_index")
        if target is None and game.inactive_player.board:
            target = _best_spell_target_index(game)
        return game.play_card(action["card_index"], spell_target_index=target)
    if kind == "attack":
        return game.attack(action["attacker_index"], action.get("target_index"))
    if kind == "hero_power":
        return game.use_hero_power(
            target_index=action.get("target_index"),
            target_side=action.get("target_side", "face"),
        )
    return {"success": False, "error": f"Unknown action {kind}"}


def _greedy_shadow(name: str, faction: str) -> AIPlayer:
    shadow = AIPlayer(name=name, faction=faction, difficulty="medium")
    shadow._in_lookahead = True
    return shadow


def _resolve_pending(game: Game) -> None:
    if getattr(game, "pending_discovery", None):
        game.choose_discovery(_best_discovery_index(game))
    if getattr(game, "pending_split", None):
        pick, target = _best_split_choice(game)
        game.choose_split(pick, target_index=target)


def _pick_with_lookahead(
    game: Game,
    ai: AIPlayer,
    candidates: list[tuple[float, dict[str, Any]]],
) -> dict[str, Any]:
    """Score top greedy moves by simulating our rest of turn plus the opponent reply."""
    legal = [(s, a) for s, a in candidates if s > -math.inf]
    if not legal:
        return {"action": "end_turn"}
    top = legal[:HARD_CANDIDATE_CAP]
    me = game.active_player.name
    opp = game.inactive_player
    best_action = top[0][1]
    best_value = -math.inf
    for greedy_score, action in top:
        future = copy.deepcopy(game)
        _simulate_self_then_opponent(future, action, ai, me, opp.name, opp.faction)
        value = _evaluate_state(future, me) + greedy_score * 0.03
        if value > best_value:
            best_value = value
            best_action = action
    return best_action


def _simulate_self_then_opponent(
    game: Game,
    first: dict[str, Any],
    ai: AIPlayer,
    me: str,
    opp_name: str,
    opp_faction: str,
) -> None:
    result = _perform_action(game, first)
    _resolve_pending(game)
    if first["action"] != "end_turn" and result.get("success") and not game.is_over and game.turn_started:
        execute_turn(game, _greedy_shadow(ai.name, ai.faction))
    elif first["action"] != "end_turn" and not result.get("success") and not game.is_over and game.turn_started:
        game.end_turn()
    if game.is_over:
        return
    if not game.turn_started:
        game.start_turn()
    if game.is_over:
        return
    # Only let the opponent reply if it is actually their turn.
    if game.active_player.name == opp_name:
        execute_turn(game, _greedy_shadow(opp_name, opp_faction))


def _evaluate_state(game: Game, name: str) -> float:
    if game.winner == name:
        return 10_000.0
    if game.winner:
        return -10_000.0
    me = next(p for p in game.players if p.name == name)
    opp = next(p for p in game.players if p.name != name)
    score = _board_power(me) - _board_power(opp)
    score += (me.life - opp.life) * 0.4
    if opp.life <= 8:
        score += (8 - opp.life) * 1.5
    if me.life <= 8:
        score -= (8 - me.life) * 1.8
    return score


def score_action(game: Game, action: dict[str, Any], ai: AIPlayer | None = None) -> float:
    """
    Score a hypothetical action. Higher scores are better.

    Returns -inf for invalid/unplayable actions.
    """
    if action["action"] == "end_turn":
        return _score_end_turn(game)
    if action["action"] == "play":
        return _score_play_card(game, action["card_index"], ai)
    if action["action"] == "recycle":
        return _score_recycle(game, action["card_index"])
    if action["action"] == "attack":
        return _score_attack(game, action["attacker_index"], action.get("target_index"), ai)
    if action["action"] == "hero_power":
        return _score_hero_power(game, action, ai)
    return -math.inf


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------


def _card_text(card: Card) -> str:
    return f"{getattr(card, 'ability', '') or ''} {getattr(card, 'effect', '') or ''}"


def _keyword_score(text: str) -> float:
    """Value printed evergreen / combat keywords on a card about to be played."""
    score = 0.0
    keys = prefix_keywords(text)
    mapping = {
        "Taunt": 2.0,
        "Stealth": 1.5,
        "Charge": 2.2,
        "Rush": 1.6,
        "Drain": 1.3,
        "Venom": 2.4,
        "Recur": 1.5,
        "Ward": 1.6,
        "Shielding": 1.3,
        "Enraged": 1.6,
        "Amplify": 1.1,
        "Flash": 0.8,
        "Opening": 0.8,
        "Manifest": 1.0,
        "Recycle": 0.4,
        "Echo": 0.7,
        "Excess": 0.8,
        "Retaliate": 1.0,
        "Stasis": -0.4,
    }
    for key, value in mapping.items():
        if key in keys or key in text:
            score += value
    if "Deathrattle" in text or "When this character dies" in text:
        score += 1.6
    if "Discover" in text:
        score += 1.2
    if "Split:" in text:
        score += 0.8
    lowered = text.lower()
    if "discard" in lowered:
        score += 1.6
    if "return an enemy" in lowered or "return a target" in lowered:
        score += 1.4
    if "take control" in lowered:
        score += 2.0
    return score


def _score_end_turn(game: Game) -> float:
    """Score ending the turn. Baseline — only do this when nothing better."""
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


def _hero_power_candidates(game: Game) -> list[dict[str, Any]]:
    """Legal faction-power actions for the active player."""
    player = game.active_player
    opponent = game.inactive_player
    power = power_for(player.faction)
    if power is None or player.hero_power_used or player.energy < power.cost:
        return []
    if not game.turn_started:
        return []
    if power.id == "call_initiate":
        if len(player.board) >= Player.MAX_BOARD_SIZE:
            return []
        return [{"action": "hero_power", "target_side": "face"}]
    if power.id == "psi_lash":
        return [{"action": "hero_power", "target_side": "face"}]
    if power.id == "pull_strings":
        actions: list[dict[str, Any]] = [{"action": "hero_power", "target_side": "face"}]
        for i, char in enumerate(opponent.board):
            if has_stealth(char):
                continue
            actions.append({
                "action": "hero_power",
                "target_side": "enemy",
                "target_index": i,
            })
        return actions
    return []


def _score_hero_power(game: Game, action: dict[str, Any], ai: AIPlayer | None) -> float:
    player = game.active_player
    opponent = game.inactive_player
    power = power_for(player.faction)
    if power is None or player.hero_power_used or player.energy < power.cost:
        return -math.inf
    weights = (ai.weights if ai else None) or FACTION_WEIGHTS.get(
        player.faction, FACTION_WEIGHTS["illuminati"]
    )
    score = 1.0
    if power.id == "call_initiate":
        if len(player.board) >= Player.MAX_BOARD_SIZE:
            return -math.inf
        score += weights.get("board_presence", 1.0) * 1.6
        score += weights.get("taunt_value", 1.0) * 1.4
        if len(player.board) < 3:
            score += 1.2
        return score
    if power.id == "psi_lash":
        score += weights.get("face_damage", 1.0) * 2.2
        if opponent.life <= 8:
            score += (8 - opponent.life) * 0.8
        if opponent.life <= 2:
            score += 8.0
        return score
    if power.id == "pull_strings":
        side = action.get("target_side", "face")
        if side == "enemy":
            idx = action.get("target_index")
            if idx is None or idx < 0 or idx >= len(opponent.board):
                return -math.inf
            target = opponent.board[idx]
            if has_stealth(target):
                return -math.inf
            score += weights.get("enemy_removal", 1.0) * 0.8
            if target.current_health <= 1:
                score += 4.0 + target.current_attack
            else:
                score += 0.4
            return score
        score += weights.get("face_damage", 1.0) * 0.9
        if opponent.life <= 4:
            score += 3.0
        return score
    return -math.inf


def _score_play_card(game: Game, card_index: int, ai: AIPlayer | None = None) -> float:
    """Score playing a specific card from hand."""
    player = game.active_player

    if card_index < 0 or card_index >= len(player.hand):
        return -math.inf

    card = player.hand[card_index]

    if player.energy < card.cost:
        return -math.inf

    if not player.can_play_card(card):
        return -math.inf

    score = 0.0
    card_type = card.type.value if hasattr(card, "type") else ""

    score += card.cost * 0.5

    from engine.effects import effect_requires_board_target

    text = _card_text(card)
    if "friendly" in text.lower() and not player.board:
        return -math.inf
    if (
        effect_requires_board_target(text)
        and "friendly" not in text.lower()
        and not game.inactive_player.board
    ):
        return -math.inf

    if card_type == "Character":
        score += _score_character_card(game, card, ai)
    elif card_type == "Spell":
        score += _score_spell_card(game, card)
    elif card_type == "Location":
        score += _score_location_card(game, card)

    affordable = [c for c in player.hand if player.can_play_card(c)]
    if affordable:
        max_cost = max(c.cost for c in affordable)
        if card.cost == max_cost:
            score += 1.0

    score += 0.3
    return score


def _score_character_card(game: Game, card: Card, ai: AIPlayer | None = None) -> float:
    """Score playing a character card."""
    player = game.active_player
    score = 0.0
    weights = (ai.weights if ai else None) or FACTION_WEIGHTS.get(
        player.faction, FACTION_WEIGHTS["illuminati"]
    )

    if len(player.board) >= Player.MAX_BOARD_SIZE:
        return -math.inf

    score += weights.get("board_presence", 1.0) * 2.0

    if hasattr(card, "attack") and hasattr(card, "health"):
        total_stats = card.attack + card.health
        cost_efficiency = total_stats / max(1, card.cost)
        score += cost_efficiency * 1.5

    text = getattr(card, "ability", "") or ""
    score += _keyword_score(text)
    if "Taunt" in text:
        score += weights.get("taunt_value", 1.0)
    if "Stealth" in text:
        score += weights.get("stealth_value", 1.0)

    if len(player.board) < 3:
        score += 1.0

    return score


def _score_spell_card(game: Game, card: Card) -> float:
    """Score playing a spell card."""
    score = 1.0
    score += card.cost * 0.3
    text = getattr(card, "effect", "") or ""
    score += _keyword_score(text)

    enemy_power = _board_power(game.inactive_player)
    if enemy_power > 5:
        score += enemy_power * 0.5

    damage = _extract_damage(text)
    if damage:
        board = game.inactive_player.board
        if board:
            kills = sum(1 for c in board if c.current_health <= damage)
            score += kills * 3.0 + damage * 0.4
        else:
            score += damage * 0.2
    if "draw" in text.lower():
        score += 1.5
    if "silence" in text.lower() and game.inactive_player.board:
        score += 2.0
    if "discard" in text.lower():
        score += 1.8
    if "return" in text.lower() and game.inactive_player.board:
        score += 1.5
    if "split:" in text.lower() and game.inactive_player.board:
        score += 1.5
    return score


def _score_location_card(game: Game, card: Card) -> float:
    """Score playing a location card. Playing a new one replaces the old."""
    player = game.active_player
    score = 2.0 + card.cost * 0.2
    score += _keyword_score(getattr(card, "effect", "") or "")
    if player.location is not None:
        # Replacing is legal and often correct — just pay a small tax.
        score -= 1.8
    return score


def _score_recycle(game: Game, card_index: int) -> float:
    """Score paying 1 to shuffle a Recycle card and draw."""
    player = game.active_player
    if card_index < 0 or card_index >= len(player.hand):
        return -math.inf
    if player.energy < 1:
        return -math.inf
    card = player.hand[card_index]
    text = _card_text(card)
    if "Recycle" not in prefix_keywords(text):
        return -math.inf

    score = 1.0
    if card.cost > player.energy:
        score += 2.4
    elif player.can_play_card(card) and card.cost <= player.energy:
        # Could play it this turn — recycling is usually worse.
        score -= 1.8
        if card.cost >= 5:
            score += 0.6

    playable = [c for c in player.hand if player.can_play_card(c) and c is not card]
    if not playable and player.can_play_card(card):
        score -= 2.5
    if player.hand_size <= 2:
        score += 0.8
    if player.energy <= 1 and card.cost > 1:
        score += 1.2
    return score


def _score_attack(
    game: Game,
    attacker_index: int,
    target_index: int | None,
    ai: AIPlayer | None = None,
) -> float:
    """Score a specific attack action."""
    player = game.active_player
    opponent = game.inactive_player

    if attacker_index < 0 or attacker_index >= len(player.board):
        return -math.inf

    attacker = player.board[attacker_index]

    if not attacker.can_attack:
        return -math.inf

    score = 0.0
    valid_targets = get_valid_attack_targets(player, opponent)
    weights = (ai.weights if ai else None) or FACTION_WEIGHTS.get(
        player.faction, FACTION_WEIGHTS["illuminati"]
    )
    poke = ai.poke_face if ai else 0.0

    if target_index is None:
        if valid_targets:
            return -math.inf
        if getattr(attacker, "rush_locked", False):
            return -math.inf
        if not can_attack_player_directly(player, opponent):
            return -math.inf

        score += attacker.current_attack * (1.0 + weights.get("face_damage", 1.0))
        score += poke * 3.0
        if attacker.current_attack >= opponent.life:
            score += 100.0
        if getattr(attacker, "has_drain", False):
            score += attacker.current_attack * 0.4
    else:
        if target_index < 0 or target_index >= len(opponent.board):
            return -math.inf

        defender = opponent.board[target_index]
        if defender not in valid_targets:
            return -math.inf

        score += _score_character_attack(attacker, defender, player, opponent)
        if getattr(attacker, "has_venom", False):
            score += 4.0
        if getattr(attacker, "has_drain", False):
            score += min(attacker.current_attack, 30 - player.life) * 0.3

    return score


def _score_character_attack(
    attacker: CardInstance,
    defender: CardInstance,
    attacker_owner: Player,
    defender_owner: Player,
) -> float:
    """Score an attack of one character against another."""
    score = 0.0

    if attacker.current_attack >= defender.current_health or getattr(attacker, "has_venom", False):
        score += 10.0
        score += defender.current_attack * 2.0
        score += defender.current_health * 1.0

        if defender.current_attack >= attacker.current_health and not getattr(
            attacker, "has_ward", False
        ):
            my_value = attacker.current_attack + attacker.current_health
            their_value = defender.current_attack + defender.current_health
            if getattr(attacker, "has_recur", False) and not getattr(attacker, "recur_used", False):
                score += 2.0
            elif their_value > my_value:
                score += 3.0
            else:
                score -= 1.0
    else:
        score += attacker.current_attack * 0.3

    if defender.current_attack >= attacker.current_health and not getattr(attacker, "has_ward", False):
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
    """Estimate total board power of a player."""
    power = 0.0
    for char in player.board:
        power += char.current_attack * 1.0 + char.current_health * 0.5
        if has_taunt(char):
            power += 1.0
        if getattr(char, "has_recur", False) and not getattr(char, "recur_used", False):
            power += 1.5
        if getattr(char, "has_ward", False):
            power += 1.0
        if getattr(char, "has_venom", False):
            power += 1.2
    power += player.life * 0.1
    power += player.hand_size * 0.3
    return power


def _extract_damage(text: str) -> int:
    match = re.search(r"deal (\d+) damage", text.lower())
    return int(match.group(1)) if match else 0


def _best_spell_target_index(game: Game) -> int | None:
    board = game.inactive_player.board
    if not board:
        return None
    return max(range(len(board)), key=lambda i: board[i].current_attack + board[i].current_health)


def _best_discovery_index(game: Game) -> int:
    options = game.pending_discovery["cards"]
    scores = []
    for i, card in enumerate(options):
        text = _card_text(card)
        value = card.cost + _keyword_score(text)
        if hasattr(card, "attack") and hasattr(card, "health"):
            value += (card.attack + card.health) * 0.4
        scores.append((value, i))
    scores.sort(reverse=True)
    return scores[0][1]


def _best_split_choice(game: Game) -> tuple[int, int | None]:
    options = game.pending_split["options"]
    target = _best_spell_target_index(game)
    scored: list[tuple[float, int]] = []
    for i, option in enumerate(options):
        text = option.lower()
        value = 1.0
        damage = _extract_damage(text)
        if damage and game.inactive_player.board:
            value = 4.0 + damage
            if any(c.current_health <= damage for c in game.inactive_player.board):
                value += 4.0
        elif damage:
            value = 0.8
        if "draw" in text:
            value = 3.0 if game.active_player.hand_size < 5 else 1.6
        if "restore" in text or "heal" in text:
            missing = 30 - game.active_player.life
            value = missing * 0.45
        scored.append((value, i))
    scored.sort(reverse=True)
    pick = scored[0][1]
    chosen = options[pick].lower()
    if _extract_damage(chosen) and target is None:
        target = 0 if game.inactive_player.board else None
    if "draw" in chosen or "restore" in chosen:
        target = None
    return pick, target
