"""
Game engine for Conspiracy TCG.

Orchestrates the full game lifecycle:
  - Setup (shuffle, draw starting hands)
  - Turn loop (draw phase, main phase, end phase)
  - Win condition checking
  - Action validation and dispatch

The Game class has NO UI dependencies. It exposes state as dicts and accepts
action as dicts. The CLI wraps around this.
"""

from __future__ import annotations

import random
from typing import Any

from engine.card import CardInstance
from engine.combat import resolve_attack
from engine.card import (
    has_assault_text,
    has_discovery_text,
    prefix_keywords,
    strip_prefix_keywords,
)
from engine.effects import (
    collect_discovery_options,
    effect_requires_board_target,
    fire_excess,
    fire_retaliate,
    parse_split_options,
    resolve_aura_effects,
    resolve_deathrattle,
    resolve_end_of_turn_locations,
    resolve_free_text,
    resolve_on_play_ability,
    resolve_spell_effect,
    resolve_start_of_turn_locations,
    summon_token,
)
from engine.hero_power import power_dict, power_for
from engine.keywords import clear_all_exhaustion, get_valid_attack_targets, has_stealth
from engine.models import Card
from engine.player import Player


class Game:
    """
    Full game state and turn loop for Conspiracy TCG.

    Usage:
        game = Game.setup(player1_deck, player2_deck, "Alice", "Bob")
        while not game.is_over:
            game.start_turn()
            # ... player takes actions via game.attack(), game.play_card() ...
            game.end_turn()

    Attributes:
        players: List of two Player instances (index 0 = first player).
        active_player_index: Which player's turn it is (0 or 1).
        turn_number: Current turn count (starts at 1).
        winner: Name of the winner, or None if ongoing.
        history: Log of actions taken (for replay/debugging).
        mulligan_done: Set of player names who have completed mulligan.
        turn_started: True after start_turn() until end_turn().
    """

    def __init__(self, players: list[Player], first_player_index: int = 0) -> None:
        self.players = players
        self.active_player_index = first_player_index
        self.turn_number: int = 0
        self.winner: str | None = None
        self.history: list[dict[str, Any]] = []
        self.mulligan_done: set[str] = set()
        self.turn_started: bool = False
        self.pending_discovery: dict[str, Any] | None = None
        self.pending_split: dict[str, Any] | None = None
        self.cards_played_this_turn: int = 0
        self.opening_done: bool = False
        self._draw_depth: int = 0

    @classmethod
    def setup(
        cls,
        deck1: list[Card],
        deck2: list[Card],
        player1_name: str = "Player 1",
        player2_name: str = "Player 2",
        *,
        first_player: int | None = None,
        shuffle: bool = True,
        player1_faction: str | None = None,
        player2_faction: str | None = None,
    ) -> Game:
        """
        Set up a new game.

        1. Create players and optionally shuffle decks.
        2. Draw starting hands (4 cards each).
        3. Choose first player; that player does NOT draw on their first turn.

        Args:
            first_player: 0 = player1 first, 1 = player2 first, None = random.
            shuffle: If False, decks stay in the given order (tutorial).
            player1_faction: Starting identity for player 1 (inferred if omitted).
            player2_faction: Starting identity for player 2 (inferred if omitted).
        """
        player1 = Player(player1_name, deck1, faction=player1_faction)
        player2 = Player(player2_name, deck2, faction=player2_faction)

        if shuffle:
            player1.shuffle_deck()
            player2.shuffle_deck()

        if first_player is None:
            first_idx = random.randint(0, 1)
        else:
            first_idx = 0 if first_player == 0 else 1

        players = [player1, player2]
        if first_idx == 1:
            players = [player2, player1]

        game = cls(players, first_player_index=0)

        # Draw starting hands (4 each)
        players[0].draw_starting_hand()
        players[1].draw_starting_hand()

        return game

    def mulligan(self, player_name: str, card_indices: list[int]) -> dict[str, Any]:
        """
        Perform mulligan for a player: return selected cards to the deck
        and draw replacement cards. Can only be done once per player before
        the first turn starts.

        Args:
            player_name: Name of the player performing mulligan.
            card_indices: Indices of cards in hand to mulligan back.
                          Can be empty to keep the whole hand.

        Returns:
            Result dict with cards mulliganed and drawn.
        """
        if self.turn_number > 0:
            return {"success": False, "error": "Mulligan is only available before the first turn"}

        if player_name in self.mulligan_done:
            return {"success": False, "error": f"{player_name} has already mulliganed"}

        # Find the player
        player = None
        for p in self.players:
            if p.name == player_name:
                player = p
                break
        if player is None:
            return {"success": False, "error": f"Player '{player_name}' not found"}

        # Validate indices
        if any(idx < 0 or idx >= len(player.hand) for idx in card_indices):
            return {"success": False, "error": "Invalid hand index"}

        # Remove selected cards from hand (in reverse order to preserve indices)
        mulliganed_cards = []
        for idx in sorted(set(card_indices), reverse=True):
            mulliganed_cards.append(player.hand.pop(idx))

        # Shuffle the returned cards back into the deck
        player.deck.extend(mulliganed_cards)
        player.shuffle_deck()

        # Draw replacement cards
        drawn_cards = []
        for _ in range(len(mulliganed_cards)):
            card = player.draw_card()
            if card:
                drawn_cards.append(card.name)

        # Mark mulligan as done
        self.mulligan_done.add(player_name)

        result = {
            "success": True,
            "mulliganed": [c.name for c in mulliganed_cards],
            "drawn": drawn_cards,
            "player": player_name,
            "hand_size": len(player.hand),
        }
        self._log_action("mulligan", result)
        return result

    @property
    def both_players_mulliganed(self) -> bool:
        """True if both players have completed mulligan."""
        return len(self.mulligan_done) >= 2

    def start_turn(self) -> dict[str, Any]:
        """
        Start a new turn. Called at the beginning of each turn.

        Steps:
        1. Increment turn number.
        2. Increase max energy by 1 and refresh to full.
        3. Draw a card (except first player's first turn).
        4. Clear exhaustion from all characters.
        5. Resolve start-of-turn location effects.
        6. Resolve aura/ongoing effects.

        Returns:
            Turn-start status dict.
        """
        if self.pending_discovery or self.pending_split:
            return {"success": False, "error": "Choose a pending card effect first"}
        if self.turn_started:
            return {"success": False, "error": "Turn already started", "turn": self.turn_number}

        self.turn_number += 1
        self.turn_started = True
        player = self.active_player

        # Energy increases each turn (up to max)
        player.max_energy = min(Player.MAX_ENERGY, player.max_energy + 1)
        player.energy = player.max_energy
        player.hero_power_used = False

        # First player's first turn: don't draw
        drew_card = None
        if not (self.turn_number == 1 and self.active_player_index == 0):
            drew_card = self._draw(player)

        # Clear exhaustion on all characters
        clear_all_exhaustion(self, player)
        for character in player.board:
            if character.stasis:
                character.is_exhausted = True

        self._fire_opening()

        # Start-of-turn location effects (healing, etc.)
        loc_results = resolve_start_of_turn_locations(self, player)

        # Aura/ongoing effects from locations and characters
        aura_results = resolve_aura_effects(self, player)

        result = {
            "success": True,
            "turn": self.turn_number,
            "player": player.name,
            "drew": drew_card.name if drew_card else None,
            "energy": player.energy,
            "max_energy": player.max_energy,
            "location_effects": [r.to_dict() for r in loc_results],
            "aura_effects": [r.to_dict() for r in aura_results],
        }

        self._log_action("turn_start", result)
        return result

    @property
    def active_player(self) -> Player:
        """The player whose turn it is."""
        return self.players[self.active_player_index]

    @property
    def inactive_player(self) -> Player:
        """The opponent of the active player."""
        idx = 1 - self.active_player_index
        return self.players[idx]

    @property
    def is_over(self) -> bool:
        """True if the game is over (a player has died)."""
        return self.winner is not None

    def _resolve_effect_target(
        self,
        spell_target_index: int | None = None,
        target_side: str = "enemy",
    ) -> tuple[CardInstance | None, Player | None]:
        """
        Resolve a spell/ability target from side + index.

        target_side:
          - "enemy": index into the opponent's board (default, backward compatible)
          - "ally":  index into the active player's board
          - "hero":  the active player's hero (target_player set, no instance)
        """
        player = self.active_player
        opponent = self.inactive_player
        side = (target_side or "enemy").lower().strip()

        if side == "hero":
            return None, player

        if side == "ally":
            if spell_target_index is not None and 0 <= spell_target_index < len(player.board):
                return player.board[spell_target_index], None
            return None, None

        # Default: enemy board
        if spell_target_index is not None and 0 <= spell_target_index < len(opponent.board):
            return opponent.board[spell_target_index], None
        return None, None

    def play_card(
        self,
        card_index: int,
        spell_target_index: int | None = None,
        target_side: str = "enemy",
    ) -> dict[str, Any]:
        """
        Play a card from the active player's hand.

        Args:
            card_index: Index into the active player's hand.
            spell_target_index: Board index for targeted effects, or None.
            target_side: "enemy" (default), "ally", or "hero".
                - enemy: index into opponent's board
                - ally:  index into your board
                - hero:  your hero (heals etc.); spell_target_index ignored

        Returns:
            Result dict with outcome info.
        """
        player = self.active_player

        if self.pending_discovery or self.pending_split:
            return {"success": False, "error": "Choose a pending card effect first"}

        if card_index < 0 or card_index >= len(player.hand):
            return {"success": False, "error": "Invalid hand index"}

        card = player.hand[card_index]
        already_played = self.cards_played_this_turn

        play_cost = player.play_cost(card)
        if player.energy < play_cost:
            return {
                "success": False,
                "error": f"Not enough energy (need {play_cost}, have {player.energy})",
            }

        target_instance, target_player = self._resolve_effect_target(
            spell_target_index, target_side
        )

        # Characters and locations go to the board via player.play_card()
        card_type = card.type.value if hasattr(card, "type") else ""

        if card_type in ("Character", "Location"):
            instance = player.play_card(card)
            if instance is None or not isinstance(instance, CardInstance):
                return {"success": False, "error": "Could not play card (board full?)"}

            if card_type == "Character":
                ready = instance.has_charge or instance.has_rush
                instance.is_exhausted = not ready
                instance.rush_locked = instance.has_rush and not instance.has_charge

            result = {
                "success": True,
                "action": f"play_{card_type.lower()}",
                "card": card.name,
                "instance_id": instance.instance_id,
            }

            if card_type == "Character":
                ability = instance.card.ability if hasattr(instance.card, "ability") else ""
                if has_assault_text(ability) and not instance.is_silenced:
                    effect_result = resolve_on_play_ability(
                        self, player.name, instance, target_instance=target_instance
                    )
                    if effect_result is not None:
                        result["effect"] = effect_result.to_dict()
                if has_discovery_text(ability) and not instance.is_silenced:
                    self._begin_discovery(player)
                    result["discovery"] = True

        else:
            effect_text = getattr(card, "effect", "") or ""
            if effect_requires_board_target(effect_text) and target_instance is None:
                return {
                    "success": False,
                    "error": f"{card.name} needs a target",
                }
            # Spells: spend energy, remove from hand, resolve effect
            player.hand.pop(card_index)
            player.spend_energy(play_cost)

            split_options = parse_split_options(effect_text)
            if split_options:
                self.pending_split = {
                    "player": player.name,
                    "card": card.name,
                    "options": split_options,
                }
                result = {
                    "success": True,
                    "action": "play_spell",
                    "card": card.name,
                    "split": True,
                }
            else:
                spell_result = resolve_spell_effect(
                    self,
                    player.name,
                    card,
                    target_instance=target_instance,
                    target_player=target_player,
                )
                result = {
                    "success": spell_result.success,
                    "action": "play_spell",
                    "card": card.name,
                    "effect": spell_result.to_dict(),
                }

        self._after_play_keywords(player, card, already_played, target_instance, result)

        deaths = self._resolve_deaths()
        if deaths["player_slain"] or deaths["opponent_slain"]:
            result["slain"] = deaths

        self._log_action("play_card", result)
        self._check_win_condition()
        return result

    def attack(self, attacker_index: int, target_index: int | None = None) -> dict[str, Any]:
        """
        Declare an attack with one of the active player's characters.

        Args:
            attacker_index: Index into the active player's board.
            target_index: Index into the opponent's board, or None to attack
                         the opponent directly.

        Returns:
            Combat result summary dict.
        """
        player = self.active_player
        opponent = self.inactive_player

        if self.pending_discovery or self.pending_split:
            return {"success": False, "error": "Choose a pending card effect first"}

        # Validate attacker
        if attacker_index < 0 or attacker_index >= len(player.board):
            return {"success": False, "error": "Invalid attacker index"}

        attacker = player.board[attacker_index]

        if not attacker.can_attack:
            return {
                "success": False,
                "error": f"{attacker.name} cannot attack",
            }

        valid_targets = get_valid_attack_targets(player, opponent)
        taunt_present = any(c.has_taunt and not has_stealth(c) for c in opponent.board)

        # Resolve defender target
        defender: CardInstance | None = None
        target_name = "opponent"

        if target_index is None:
            if attacker.rush_locked:
                return {
                    "success": False,
                    "error": f"{attacker.name} has Rush and cannot attack the hero this turn",
                }
            # Direct attack on player — only valid if no targetable characters
            if valid_targets:
                if taunt_present:
                    return {
                        "success": False,
                        "error": "Taunt is blocking a direct attack — attack a Taunt character first",
                    }
                return {
                    "success": False,
                    "error": "Must declare a target when opponent has board characters",
                }
            combat_result = resolve_attack(attacker, player, opponent, None)
        else:
            if target_index < 0 or target_index >= len(opponent.board):
                return {"success": False, "error": "Invalid target index"}

            defender = opponent.board[target_index]
            if defender not in valid_targets:
                if has_stealth(defender):
                    return {"success": False, "error": f"{defender.name} has Stealth and cannot be targeted"}
                if taunt_present:
                    return {
                        "success": False,
                        "error": "Taunt is blocking that target — attack a Taunt character first",
                    }
                return {"success": False, "error": f"{defender.name} is not a valid attack target"}
            target_name = defender.name
            combat_result = resolve_attack(attacker, player, opponent, defender)

        triggers: list[dict[str, Any]] = []
        if combat_result.damage_dealt_to_defender > 0 and defender is not None:
            retaliate = fire_retaliate(self, defender)
            if retaliate is not None:
                triggers.append(retaliate.to_dict())
        if combat_result.damage_dealt_to_attacker > 0:
            retaliate = fire_retaliate(self, attacker)
            if retaliate is not None:
                triggers.append(retaliate.to_dict())
        excess = fire_excess(self, attacker)
        if excess is not None:
            triggers.append(excess.to_dict())
        if defender is not None:
            excess = fire_excess(self, defender)
            if excess is not None:
                triggers.append(excess.to_dict())

        deaths = self._resolve_deaths()

        # Build result
        result = {
            "success": True,
            "action": "attack",
            "attacker": attacker.name,
            "target": target_name,
            "damage_dealt": combat_result.damage_dealt_to_defender,
            "damage_taken": combat_result.damage_dealt_to_attacker,
            "killed_attacker": combat_result.attacker_died,
            "killed_target": combat_result.defender_died,
            "player_slain": deaths["player_slain"],
            "opponent_slain": deaths["opponent_slain"],
            "deathrattles": deaths.get("deathrattles", []),
            "triggers": triggers,
        }

        self._log_action("attack", result)

        # Check win condition
        self._check_win_condition()

        return result

    def use_hero_power(
        self,
        target_index: int | None = None,
        target_side: str = "face",
    ) -> dict[str, Any]:
        """
        Use the active player's faction power. Once per turn, costs 2.

        target_side: "face" (enemy hero) or "enemy" (character at target_index).
        Only Illuminati Pull Strings needs a target; others ignore it.
        """
        player = self.active_player
        opponent = self.inactive_player

        if self.pending_discovery or self.pending_split:
            return {"success": False, "error": "Choose a pending card effect first"}
        if not self.turn_started:
            return {"success": False, "error": "Turn has not started"}
        if player.hero_power_used:
            return {"success": False, "error": "Faction power already used this turn"}

        power = power_for(player.faction)
        if power is None:
            return {"success": False, "error": "This identity has no faction power"}
        if player.energy < power.cost:
            return {
                "success": False,
                "error": f"Not enough energy (need {power.cost}, have {player.energy})",
            }

        result: dict[str, Any] = {
            "success": True,
            "action": "hero_power",
            "power": power.name,
            "power_id": power.id,
            "faction": player.faction,
            "fx": [],
        }

        if power.id == "call_initiate":
            if len(player.board) >= Player.MAX_BOARD_SIZE:
                return {"success": False, "error": "Board is full"}
            player.spend_energy(power.cost)
            player.hero_power_used = True
            inst = summon_token(
                self,
                player,
                name="Initiate",
                attack=1,
                health=1,
                ability="Taunt. Token.",
            )
            if inst is None:
                player.energy += power.cost
                player.hero_power_used = False
                return {"success": False, "error": "Could not summon Initiate"}
            result["summoned"] = inst.name
            result["fx"].append({"kind": "summon", "name": inst.name, "side": "ally"})

        elif power.id == "psi_lash":
            player.spend_energy(power.cost)
            player.hero_power_used = True
            dealt = opponent.direct_damage(2)
            result["damage_dealt"] = dealt
            result["target"] = "opponent"
            result["fx"].append({"kind": "damage", "amount": dealt, "target": "face", "side": "enemy"})

        elif power.id == "pull_strings":
            side = (target_side or "face").lower()
            if side == "enemy":
                if target_index is None or target_index < 0 or target_index >= len(opponent.board):
                    return {"success": False, "error": "Pull Strings needs a target"}
                defender = opponent.board[target_index]
                if has_stealth(defender):
                    return {"success": False, "error": f"{defender.name} has Stealth and cannot be targeted"}
                player.spend_energy(power.cost)
                player.hero_power_used = True
                dealt = defender.take_damage(1)
                result["damage_dealt"] = dealt
                result["target"] = defender.name
                result["fx"].append({
                    "kind": "damage",
                    "amount": dealt,
                    "target": "character",
                    "index": target_index,
                    "side": "enemy",
                    "name": defender.name,
                })
            else:
                player.spend_energy(power.cost)
                player.hero_power_used = True
                dealt = opponent.direct_damage(1)
                result["damage_dealt"] = dealt
                result["target"] = "opponent"
                result["fx"].append({"kind": "damage", "amount": dealt, "target": "face", "side": "enemy"})
        else:
            return {"success": False, "error": f"Unknown faction power {power.id}"}

        deaths = self._resolve_deaths()
        if deaths["player_slain"] or deaths["opponent_slain"]:
            result["slain"] = deaths
        if deaths.get("player_slain") or deaths.get("opponent_slain") or deaths.get("deathrattles"):
            result["deathrattles"] = deaths.get("deathrattles", [])

        self._log_action("hero_power", result)
        self._check_win_condition()
        return result

    def end_turn(self) -> dict[str, Any]:
        """
        End the active player's turn.

        Returns:
            Turn-end status dict.
        """
        if self.pending_discovery or self.pending_split:
            return {"success": False, "error": "Choose a pending card effect first"}
        player = self.active_player

        end_result = {
            "ended": player.name,
            "turn": self.turn_number,
        }

        self._log_action("end_turn", end_result)

        # End-of-turn location effects (card draw, etc.)
        loc_results = resolve_end_of_turn_locations(self, player)

        # End-of-turn cleanup (temp buffs, silence timers)
        player.end_turn_cleanup()
        player.has_ward = False
        player.hand = [
            c for c in player.hand if player.echo_expiry.get(id(c)) != self.turn_number
        ]
        player.echo_expiry = {
            k: v for k, v in player.echo_expiry.items() if v != self.turn_number
        }
        for character in player.board:
            if character.stasis:
                character.stasis = False
            if character.has_ward:
                character.has_ward = False
        self.cards_played_this_turn = 0

        # Switch active player
        self.active_player_index = 1 - self.active_player_index
        self.turn_started = False

        end_result["location_effects"] = [r.to_dict() for r in loc_results]
        return end_result

    def _begin_discovery(self, player: Player) -> None:
        """Offer three faction+Network cards."""
        self.pending_discovery = {
            "player": player.name,
            "cards": collect_discovery_options(player),
        }

    def choose_discovery(self, index: int) -> dict[str, Any]:
        """Add the chosen Discovered card to the resolving player's hand."""
        pending = self.pending_discovery
        if not pending:
            return {"success": False, "error": "No Discovery pending"}
        options = pending["cards"]
        if index < 0 or index >= len(options):
            return {"success": False, "error": "Invalid Discovery choice"}
        player = next((p for p in self.players if p.name == pending["player"]), None)
        if player is None:
            self.pending_discovery = None
            return {"success": False, "error": "Player not found"}
        chosen = options[index]
        if len(player.hand) < player.MAX_HAND_SIZE:
            player.hand.append(chosen)
            added = True
        else:
            added = False
        self.pending_discovery = None
        result = {
            "success": True,
            "card": chosen.name,
            "added": added,
            "player": player.name,
        }
        self._log_action("discover", result)
        return result

    def _draw(self, player: Player) -> Card | None:
        """Draw a card and resolve Flash / Manifest. Caps nested draws at 5."""
        if self._draw_depth >= 5:
            return player.draw_card()
        self._draw_depth += 1
        try:
            drawn = player.draw_card()
            if drawn is None:
                return None
            text = getattr(drawn, "ability", "") or getattr(drawn, "effect", "") or ""
            keys = prefix_keywords(text)
            card_type = drawn.type.value if hasattr(drawn, "type") else ""
            if "Flash" in keys:
                if drawn in player.hand:
                    player.hand.remove(drawn)
                if card_type == "Spell":
                    resolve_spell_effect(self, player.name, drawn)
                elif card_type == "Character":
                    player.summon(drawn)
            elif "Manifest" in keys and card_type == "Character":
                if drawn in player.hand:
                    player.hand.remove(drawn)
                player.summon(drawn)
            return drawn
        finally:
            self._draw_depth -= 1

    def _after_play_keywords(
        self,
        player: Player,
        card: Card,
        already_played: int,
        target_instance: CardInstance | None,
        result: dict[str, Any],
    ) -> None:
        """Resolve Chain / Echo after a successful play and count the card."""
        if not result.get("success"):
            return
        text = getattr(card, "ability", "") or getattr(card, "effect", "") or ""
        keys = prefix_keywords(text)
        if "Chain" in keys and already_played > 0:
            chain = resolve_free_text(
                self, player, strip_prefix_keywords(text), target_instance
            )
            result["chain"] = chain.to_dict()
        if "Echo" in keys:
            copy = card.model_copy(deep=True)
            if len(player.hand) < player.MAX_HAND_SIZE:
                player.hand.append(copy)
                player.echo_expiry[id(copy)] = self.turn_number
                result["echo"] = True
        self.cards_played_this_turn = already_played + 1

    def recycle(self, card_index: int) -> dict[str, Any]:
        """Pay 1 energy to shuffle a Recycle card into the deck and draw."""
        if self.pending_discovery or self.pending_split:
            return {"success": False, "error": "Choose a pending card effect first"}
        if not self.turn_started:
            return {"success": False, "error": "Turn has not started"}
        player = self.active_player
        if card_index < 0 or card_index >= len(player.hand):
            return {"success": False, "error": "Invalid hand index"}
        card = player.hand[card_index]
        text = getattr(card, "ability", "") or getattr(card, "effect", "") or ""
        if "Recycle" not in prefix_keywords(text):
            return {"success": False, "error": f"{card.name} cannot be Recycled"}
        if not player.spend_energy(1):
            return {"success": False, "error": "Not enough energy to Recycle"}
        player.hand.pop(card_index)
        player.deck.append(card)
        player.shuffle_deck()
        drawn = self._draw(player)
        result = {
            "success": True,
            "recycled": card.name,
            "drew": drawn.name if drawn else None,
        }
        self._log_action("recycle", result)
        self._check_win_condition()
        return result

    def choose_split(self, index: int, target_index: int | None = None) -> dict[str, Any]:
        """Resolve one option from a pending Split card."""
        pending = self.pending_split
        if not pending:
            return {"success": False, "error": "No Split pending"}
        options = pending["options"]
        if index < 0 or index >= len(options):
            return {"success": False, "error": "Invalid Split choice"}
        player = next((p for p in self.players if p.name == pending["player"]), None)
        if player is None:
            self.pending_split = None
            return {"success": False, "error": "Player not found"}
        target_instance = None
        opponent = self.inactive_player if player == self.active_player else self.active_player
        if target_index is not None and 0 <= target_index < len(opponent.board):
            target_instance = opponent.board[target_index]
        effect = resolve_free_text(self, player, options[index], target_instance)
        self.pending_split = None
        result = {
            "success": True,
            "choice": options[index],
            "effect": effect.to_dict(),
            "player": player.name,
        }
        deaths = self._resolve_deaths()
        if deaths["player_slain"] or deaths["opponent_slain"]:
            result["slain"] = deaths
        self._log_action("split", result)
        self._check_win_condition()
        return result

    def _fire_opening(self) -> None:
        """Once per player, fire Opening text on cards in hand or deck."""
        player = self.active_player
        if getattr(player, "opening_fired", False):
            return
        player.opening_fired = True
        self.opening_done = True
        cards: list[Card] = list(player.hand) + list(player.deck)
        if player.location is not None:
            cards.append(player.location.card)
        for card in cards:
            text = getattr(card, "ability", "") or getattr(card, "effect", "") or ""
            if "Opening" in prefix_keywords(text):
                resolve_free_text(self, player, strip_prefix_keywords(text))

    def _resolve_deaths(self) -> dict[str, Any]:
        """Remove dead characters, fire Deathrattles, then Recur survivors."""
        slain: dict[str, list[str]] = {"player_slain": [], "opponent_slain": []}
        rattles: list[dict[str, Any]] = []
        pairs = [
            (self.active_player, "player_slain"),
            (self.inactive_player, "opponent_slain"),
        ]
        pending: list[tuple[Player, CardInstance]] = []
        for player, key in pairs:
            dead = [c for c in player.board if not c.is_alive]
            player.board = [c for c in player.board if c.is_alive]
            slain[key] = [c.name for c in dead]
            pending.extend((player, c) for c in dead)
        for owner, character in pending:
            rattle = resolve_deathrattle(self, owner.name, character)
            if rattle.success:
                rattles.append(rattle.to_dict())
            if (
                character.has_recur
                and not character.recur_used
                and not character.is_silenced
                and len(owner.board) < owner.MAX_BOARD_SIZE
            ):
                character.recur_used = True
                character.has_recur = False
                character.damage_taken = max(
                    0, character._base_health + character.health_bonus - 1
                )
                character.is_exhausted = True
                character.stasis = False
                owner.board.append(character)
        extra_dead = False
        for player in self.players:
            leftover = [c for c in player.board if not c.is_alive]
            if leftover:
                extra_dead = True
                player.board = [c for c in player.board if c.is_alive]
        slain["deathrattles"] = rattles
        if extra_dead:
            slain["deathrattles"] = rattles
        return slain

    def _check_win_condition(self) -> None:
        """Check if either player has lost."""
        for player in self.players:
            if player.is_dead:
                other = self.inactive_player if player == self.active_player else self.active_player
                self.winner = other.name
                return

    def _log_action(self, action: str, data: dict[str, Any]) -> None:
        """Log an action to the game history."""
        player_name = None
        if self.players:
            player_name = self.active_player.name
        self.history.append(
            {
                "turn": self.turn_number,
                "player": player_name,
                "action": action,
                "data": data,
            }
        )

    def get_recap(self, player_name: str) -> dict[str, Any]:
        """
        Summarize the finished (or in-progress) game for the named player.

        Used by the post-match screen and the tutorial recap.
        """
        opponent = next((p for p in self.players if p.name != player_name), None)
        me = next((p for p in self.players if p.name == player_name), None)
        cards_played: list[str] = []
        damage_dealt = 0
        damage_taken = 0
        attacks = 0
        taunt_blocks = 0

        for entry in self.history:
            data = entry.get("data") or {}
            actor = entry.get("player")
            if (
                entry.get("action") == "play_card"
                and data.get("success")
                and actor == player_name
                and data.get("card")
            ):
                cards_played.append(data["card"])
            if entry.get("action") == "attack" and data.get("success"):
                if actor == player_name:
                    attacks += 1
                    damage_dealt += int(data.get("damage_dealt") or 0)
                elif actor == (opponent.name if opponent else None):
                    damage_taken += int(data.get("damage_dealt") or 0)
            if (
                entry.get("action") == "attack"
                and not data.get("success")
                and actor == player_name
                and "taunt" in str(data.get("error", "")).lower()
            ):
                taunt_blocks += 1

        you_won = self.winner == player_name
        lesson = None
        if self.is_over and not you_won:
            if taunt_blocks > 0:
                lesson = "Taunt blocked some of your attacks — clear Taunt characters first."
            elif me and opponent and opponent.life >= 15:
                lesson = "The opponent outlasted you. Look for more face damage or removal."
            elif len(cards_played) < 6:
                lesson = "You played few cards. Keep a cheaper curve so you can spend energy every turn."
            elif me and len(me.board) == 0:
                lesson = "You ran out of board presence. Protect key characters or rebuild faster."
            else:
                lesson = "Watch the opponent's life total — racing or removing their threats both win games."

        return {
            "winner": self.winner,
            "you_won": you_won,
            "turns": self.turn_number,
            "cards_played": cards_played,
            "cards_played_count": len(cards_played),
            "damage_dealt": damage_dealt,
            "damage_taken": damage_taken,
            "attacks": attacks,
            "life": {
                p.name: p.life for p in self.players
            },
            "lesson": lesson,
        }

    def get_state(self) -> dict[str, Any]:
        """
        Get a serializable snapshot of the current game state.

        Returns:
            Dict with full game state (safe to serialize).
        """
        return {
            "turn": self.turn_number,
            "active_player": self.active_player.name,
            "players": [
                {
                    "name": p.name,
                    "faction": getattr(p, "faction", ""),
                    "shield": getattr(p, "has_shield", False),
                    "ward": getattr(p, "has_ward", False),
                    "life": p.life,
                    "energy": p.energy,
                    "max_energy": p.max_energy,
                    "hero_power_used": getattr(p, "hero_power_used", False),
                    "hero_power": power_dict(
                        getattr(p, "faction", ""),
                        used=getattr(p, "hero_power_used", False),
                        energy=p.energy,
                        turn_started=self.turn_started and p.name == self.active_player.name,
                    ),
                    "hand_size": p.hand_size,
                    "deck_size": p.deck_size,
                    "board": [
                        {
                            "id": c.card.id if hasattr(c, "card") else "",
                            "name": c.name,
                            "cost": c.cost,
                            "faction": c.card.faction.value if hasattr(c.card, "faction") else "",
                            "type": (
                                c.card.type.value if hasattr(c.card, "type") else "Character"
                            ),
                            "lore": getattr(c.card, "lore", ""),
                            "ability": getattr(c.card, "ability", ""),
                            "attack": c.current_attack,
                            "health": c.current_health,
                            "alive": c.is_alive,
                            "exhausted": c.is_exhausted,
                            "stealth": c.is_stealth,
                            "silenced": c.is_silenced,
                            "taunt": c.has_taunt,
                            "charge": c.has_charge,
                            "rush": c.has_rush,
                            "rush_locked": c.rush_locked,
                            "enraged": c.has_enraged,
                            "shield": c.has_shield,
                            "drain": c.has_drain,
                            "venom": c.has_venom,
                            "recur": c.has_recur,
                            "stasis": c.stasis,
                            "amplify": c.amplify,
                            "recycle": c.has_recycle,
                            "chain": c.has_chain,
                            "echo": c.has_echo,
                            "excess": c.has_excess,
                            "retaliate": c.has_retaliate,
                            "ward": c.has_ward,
                            "damage_taken": c.damage_taken,
                        }
                        for c in p.board
                    ],
                    "hand": [
                        {
                            "id": c.id,
                            "name": c.name,
                            "cost": c.cost,
                            "faction": c.faction.value if hasattr(c, "faction") else "",
                            "type": c.type.value if hasattr(c, "type") else "",
                            "lore": c.lore,
                            **(
                                {"attack": c.attack, "health": c.health, "ability": c.ability}
                                if c.type.value == "Character"
                                else {}
                            ),
                            **(
                                {"effect": c.effect}
                                if c.type.value in ("Spell", "Location")
                                else {}
                            ),
                            "recycle": "Recycle"
                            in prefix_keywords(
                                getattr(c, "ability", "") or getattr(c, "effect", "") or ""
                            ),
                        }
                        for c in p.hand
                    ],
                    "location": (
                        None
                        if p.location is None
                        else {
                            "id": getattr(p.location.card, "id", ""),
                            "name": p.location.name,
                            "cost": p.location.cost,
                            "faction": (
                                p.location.card.faction.value
                                if hasattr(p.location.card, "faction")
                                else ""
                            ),
                            "effect": getattr(p.location.card, "effect", ""),
                            "lore": getattr(p.location.card, "lore", ""),
                            "type": "Location",
                        }
                    ),
                }
                for p in self.players
            ],
            "is_over": self.is_over,
            "winner": self.winner,
            "turn_started": self.turn_started,
            "mulligan_done": sorted(self.mulligan_done),
            "pending_discovery": (
                None
                if not self.pending_discovery
                else {
                    "player": self.pending_discovery["player"],
                    "cards": [
                        {
                            "id": c.id,
                            "name": c.name,
                            "cost": c.cost,
                            "faction": c.faction.value if hasattr(c.faction, "value") else str(c.faction),
                            "type": c.type.value if hasattr(c.type, "value") else str(c.type),
                            "ability": getattr(c, "ability", "") or "",
                            "effect": getattr(c, "effect", "") or "",
                            **(
                                {"attack": c.attack, "health": c.health}
                                if getattr(c, "type", None) and c.type.value == "Character"
                                else {}
                            ),
                        }
                        for c in self.pending_discovery["cards"]
                    ],
                }
            ),
            "pending_split": (
                None
                if not self.pending_split
                else {
                    "player": self.pending_split["player"],
                    "card": self.pending_split.get("card"),
                    "options": list(self.pending_split["options"]),
                }
            ),
        }
