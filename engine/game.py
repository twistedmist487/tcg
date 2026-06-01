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
from engine.effects import (
    resolve_aura_effects,
    resolve_end_of_turn_locations,
    resolve_on_play_ability,
    resolve_spell_effect,
    resolve_start_of_turn_locations,
)
from engine.keywords import clear_all_exhaustion
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
    """

    def __init__(self, players: list[Player], first_player_index: int = 0) -> None:
        self.players = players
        self.active_player_index = first_player_index
        self.turn_number: int = 0
        self.winner: str | None = None
        self.history: list[dict[str, Any]] = []
        self.mulligan_done: set[str] = set()

    @classmethod
    def setup(
        cls,
        deck1: list[Card],
        deck2: list[Card],
        player1_name: str = "Player 1",
        player2_name: str = "Player 2",
    ) -> Game:
        """
        Set up a new game.

        1. Create players and shuffle decks.
        2. Draw starting hands (4 cards each).
        3. Random first player; that player does NOT draw on their first turn.
        """
        player1 = Player(player1_name, deck1)
        player2 = Player(player2_name, deck2)

        player1.shuffle_deck()
        player2.shuffle_deck()

        # Random first player
        first_idx = random.randint(0, 1)
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
        self.turn_number += 1
        player = self.active_player

        # Energy increases each turn (up to max)
        player.max_energy = min(Player.MAX_ENERGY, player.max_energy + 1)
        player.energy = player.max_energy

        # First player's first turn: don't draw
        drew_card = None
        if not (self.turn_number == 1 and self.active_player_index == 0):
            drew_card = player.draw_card()

        # Clear exhaustion on all characters
        clear_all_exhaustion(self, player)

        # Start-of-turn location effects (healing, etc.)
        loc_results = resolve_start_of_turn_locations(self, player)

        # Aura/ongoing effects from locations and characters
        aura_results = resolve_aura_effects(self, player)

        result = {
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

    def play_card(self, card_index: int, spell_target_index: int | None = None) -> dict[str, Any]:
        """
        Play a card from the active player's hand.

        Args:
            card_index: Index into the active player's hand.
            spell_target_index: Index into the opponent's board for targeted
                                spells (damage, debuff, mind control, etc.).
                                None for non-targeted spells (AOE, draw, etc.).

        Returns:
            Result dict with outcome info.
        """
        player = self.active_player

        if card_index < 0 or card_index >= len(player.hand):
            return {"success": False, "error": "Invalid hand index"}

        card = player.hand[card_index]

        if player.energy < card.cost:
            return {
                "success": False,
                "error": f"Not enough energy (need {card.cost}, have {player.energy})",
            }

        # Characters and locations go to the board via player.play_card()
        card_type = card.type.value if hasattr(card, "type") else ""

        if card_type in ("Character", "Location"):
            instance = player.play_card(card)
            if instance is None or not isinstance(instance, CardInstance):
                return {"success": False, "error": "Could not play card (board full?)"}

            # Exhaust characters (summoning sickness)
            if card_type == "Character":
                instance.is_exhausted = True

            result = {
                "success": True,
                "action": f"play_{card_type.lower()}",
                "card": card.name,
                "instance_id": instance.instance_id,
            }

            # Resolve on-play abilities for characters
            if card_type == "Character":
                effect_result = resolve_on_play_ability(self, player.name, instance)
                if effect_result is not None:
                    result["effect"] = effect_result.to_dict()

        else:
            # Spells: spend energy, remove from hand, resolve effect
            player.hand.pop(card_index)
            player.spend_energy(card.cost)

            # Resolve target instance from opponent's board if provided
            target_instance = None
            if spell_target_index is not None:
                opponent = self.inactive_player
                if 0 <= spell_target_index < len(opponent.board):
                    target_instance = opponent.board[spell_target_index]

            spell_result = resolve_spell_effect(
                self, player.name, card, target_instance=target_instance
            )
            result = {
                "success": spell_result.success,
                "action": "play_spell",
                "card": card.name,
                "effect": spell_result.to_dict(),
            }

        self._log_action("play_card", result)
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

        # Validate attacker
        if attacker_index < 0 or attacker_index >= len(player.board):
            return {"success": False, "error": "Invalid attacker index"}

        attacker = player.board[attacker_index]

        if not attacker.can_attack:
            return {
                "success": False,
                "error": f"{attacker.name} cannot attack",
            }

        # Resolve defender target
        defender: CardInstance | None = None
        target_name = "opponent"

        if target_index is None:
            # Direct attack on player — only valid if opponent has no board
            if len(opponent.board) > 0:
                return {
                    "success": False,
                    "error": "Must declare a target when opponent has board characters",
                }
            combat_result = resolve_attack(attacker, player, opponent, None)
        else:
            if target_index < 0 or target_index >= len(opponent.board):
                return {"success": False, "error": "Invalid target index"}

            defender = opponent.board[target_index]
            target_name = defender.name
            combat_result = resolve_attack(attacker, player, opponent, defender)

        # Check for dead characters on both sides
        player_dead = player.remove_dead_characters()
        opponent_dead = opponent.remove_dead_characters()

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
            "player_slain": [c.name for c in player_dead],
            "opponent_slain": [c.name for c in opponent_dead],
        }

        self._log_action("attack", result)

        # Check win condition
        self._check_win_condition()

        return result

    def end_turn(self) -> dict[str, Any]:
        """
        End the active player's turn.

        Returns:
            Turn-end status dict.
        """
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

        # Switch active player
        self.active_player_index = 1 - self.active_player_index

        end_result["location_effects"] = [r.to_dict() for r in loc_results]
        return end_result

    def _check_win_condition(self) -> None:
        """Check if either player has lost."""
        for player in self.players:
            if player.is_dead:
                other = self.inactive_player if player == self.active_player else self.active_player
                self.winner = other.name
                return

    def _log_action(self, action: str, data: dict[str, Any]) -> None:
        """Log an action to the game history."""
        self.history.append(
            {
                "turn": self.turn_number,
                "action": action,
                "data": data,
            }
        )

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
                    "life": p.life,
                    "energy": p.energy,
                    "max_energy": p.max_energy,
                    "hand_size": p.hand_size,
                    "deck_size": p.deck_size,
                    "board": [
                        {
                            "name": c.name,
                            "cost": c.cost,
                            "faction": c.card.faction.value if hasattr(c.card, "faction") else "",
                            "attack": c.current_attack,
                            "health": c.current_health,
                            "alive": c.is_alive,
                            "exhausted": c.is_exhausted,
                            "stealth": c.is_stealth,
                            "silenced": c.is_silenced,
                            "taunt": c.has_taunt,
                            "damage_taken": c.damage_taken,
                        }
                        for c in p.board
                    ],
                    "hand": [
                        {
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
                        }
                        for c in p.hand
                    ],
                    "location": (None if p.location is None else {"name": p.location.name}),
                }
                for p in self.players
            ],
            "is_over": self.is_over,
            "winner": self.winner,
        }
