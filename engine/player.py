"""
Player state for Conspiracy TCG.

Each Player has:
  - A deck (shuffled list of Cards)
  - A hand (cards drawn from the deck)
  - A board (CardInstances currently in play)
  - Life points (default 30)
  - Energy pool for the current turn
  - Max energy cap that grows each turn
  - A played location (max 1 per player)
"""

from __future__ import annotations

import random

from engine.card import CardInstance, create_card_instance
from engine.models import Card


class Player:
    """
    Represents a single player in the game.

    Attributes:
        name: Player's display name.
        deck: Remaining cards in the deck (face-down).
        hand: Cards in the player's hand.
        board: Character instances currently on the board.
        location: The active location instance (max 1, or None).
        life: Current life points.
        energy: Current available energy for this turn.
        max_energy: Maximum energy cap for this turn.
        fatigue_damage: Accumulated damage from failed draws (deck out).
        instance_counter: Counter for generating unique instance IDs.
    """

    STARTING_HAND_SIZE: int = 4
    STARTING_LIFE: int = 30
    MAX_HAND_SIZE: int = 10
    MAX_BOARD_SIZE: int = 7
    MAX_ENERGY: int = 10

    def __init__(
        self,
        name: str,
        deck: list[Card],
        faction: str | None = None,
    ) -> None:
        """
        Initialize a player.

        Args:
            name: Display name for this player.
            deck: List of Card objects. Will be copied and shuffled.
            faction: Starting identity (illuminati/templars/reptilians).
                Inferred from the deck if omitted.
        """
        self.name: str = name
        self.deck: list[Card] = list(deck)
        self.hand: list[Card] = []
        self.board: list[CardInstance] = []
        self.location: CardInstance | None = None
        self.life: int = self.STARTING_LIFE
        self.energy: int = 0
        self.max_energy: int = 0
        self.fatigue_damage: int = 0
        self.instance_counter: int = 0
        self.faction: str = faction or self.infer_faction(self.deck)
        self.has_shield: bool = False
        self.has_ward: bool = False
        self.echo_expiry: dict[int, int] = {}
        self.opening_fired: bool = False
        self.hand_cost_bonus: dict[int, int] = {}
        self.hero_power_used: bool = False

    @staticmethod
    def infer_faction(deck: list[Card]) -> str:
        """Majority non-neutral faction in a deck list."""
        counts: dict[str, int] = {}
        for card in deck:
            faction = card.faction.value if hasattr(card.faction, "value") else str(card.faction)
            if faction and faction != "neutral":
                counts[faction] = counts.get(faction, 0) + 1
        if not counts:
            return "neutral"
        return max(counts, key=counts.get)

    def shuffle_deck(self) -> None:
        """Shuffle the player's deck."""
        random.shuffle(self.deck)

    def draw_card(self) -> Card | None:
        """
        Draw the top card from the deck into hand.

        Returns:
            The drawn Card, or None if the deck is empty (triggers fatigue).

        Side effects:
            If deck is empty, deals 1 fatigue damage and increments fatigue counter.
        """
        if not self.deck:
            # Deck out — take fatigue damage
            self.fatigue_damage += 1
            self.life -= self.fatigue_damage
            return None

        card = self.deck.pop(0)

        if len(self.hand) >= self.MAX_HAND_SIZE:
            # Hand is full — card is discarded (burned)
            return card

        self.hand.append(card)
        return card

    def draw_starting_hand(self) -> None:
        """Draw the starting hand (4 cards)."""
        for _ in range(self.STARTING_HAND_SIZE):
            self.draw_card()

    def play_cost(self, card: Card) -> int:
        """Printed cost plus any temporary hand-cost bumps (Wiretap)."""
        return max(0, card.cost + int(self.hand_cost_bonus.get(id(card), 0)))

    def can_play_card(self, card: Card) -> bool:
        """Check if the player has enough energy to play a card."""
        return self.energy >= self.play_cost(card)

    def spend_energy(self, amount: int) -> bool:
        """
        Spend energy to play a card or use an ability.

        Returns:
            True if energy was sufficient and spent, False otherwise.
        """
        if amount < 0:
            raise ValueError("Cannot spend negative energy")
        if self.energy >= amount:
            self.energy -= amount
            return True
        return False

    def gain_energy(self, amount: int = 1) -> None:
        """Gain energy (called during main phase, capped at MAX_ENERGY)."""
        self.energy = min(self.MAX_ENERGY, self.energy + amount)

    def increase_max_energy(self, amount: int = 1) -> None:
        """Increase the max energy cap (called at the start of each turn)."""
        self.max_energy = min(self.MAX_ENERGY, self.max_energy + amount)

    def refresh_energy(self) -> None:
        """Set current energy to max_energy (called at the start of main phase)."""
        self.energy = self.max_energy

    def play_card(self, card: Card, opponent: "Player | None" = None) -> CardInstance | Card | None:
        """
        Play a card from hand.

        For Characters: places a CardInstance on the board (exhausted).
        For Spells: resolves immediately and returns the card for effect handling.
        For Locations: replaces any existing location, places on field.

        Returns:
            CardInstance for characters/locations, Card for spells (or None if play failed).
        """
        if card not in self.hand:
            return None

        if not self.spend_energy(self.play_cost(card)):
            return None

        # Remove from hand
        self.hand.remove(card)

        card_type = card.type.value if hasattr(card, "type") else ""

        if card_type == "Character":
            return self._play_character(card)
        elif card_type == "Spell":
            return card  # caller resolves the effect
        elif card_type == "Location":
            return self._play_location(card)
        else:
            return None

    def _generate_instance_id(self) -> str:
        """Generate a unique instance ID for this player's cards."""
        self.instance_counter += 1
        return f"{self.name}_{self.instance_counter}"

    def _play_character(self, card: Card) -> CardInstance | None:
        """Place a character on the board."""
        if len(self.board) >= self.MAX_BOARD_SIZE:
            return None

        instance = create_card_instance(card, self._generate_instance_id(), self.name)
        self.board.append(instance)
        return instance

    def _play_location(self, card: Card) -> CardInstance | None:
        """Play a location, replacing any existing one."""
        instance = create_card_instance(card, self._generate_instance_id(), self.name)
        # Exhausted doesn't apply to locations
        instance.is_exhausted = False
        self.location = instance
        return instance

    def remove_dead_characters(self) -> list[CardInstance]:
        """
        Remove dead characters (health <= 0) from the board.

        Returns:
            List of removed/fallen characters.
        """
        dead = [c for c in self.board if not c.is_alive]
        self.board = [c for c in self.board if c.is_alive]
        return dead

    def direct_damage(self, amount: int) -> int:
        """
        Deal direct damage to the player's life total.

        Returns:
            Actual damage dealt.
        """
        if amount < 0:
            raise ValueError("Damage must be non-negative")
        if amount == 0:
            return 0
        if self.has_ward:
            return 0
        if self.has_shield:
            self.has_shield = False
            return 0
        self.life -= amount
        return amount

    def summon(self, card: Card) -> CardInstance | None:
        """Put a character onto the board without paying or drawing from hand."""
        return self._play_character(card)

    @property
    def board_size(self) -> int:
        """Number of characters on the board."""
        return len(self.board)

    @property
    def deck_size(self) -> int:
        """Number of cards remaining in the deck."""
        return len(self.deck)

    @property
    def hand_size(self) -> int:
        """Number of cards in hand."""
        return len(self.hand)

    @property
    def is_dead(self) -> bool:
        """True if the player has lost (life <= 0)."""
        return self.life <= 0

    @property
    def is_active(self) -> bool:
        """Alias for not dead."""
        return not self.is_dead

    def get_character_instances(self) -> list[CardInstance]:
        """Get all characters on the board."""
        return list(self.board)

    def get_attackable_characters(self) -> list[CardInstance]:
        """Get characters that can attack (not exhausted and attack > 0)."""
        return [c for c in self.board if c.can_attack]

    def end_turn_cleanup(self) -> None:
        """Clean up end-of-turn effects (clear temp buffs, reduce silence duration)."""
        self.hand_cost_bonus = {}
        for character in self.board:
            character.clear_temp_buffs()
            # Reduce silence duration
            if character.is_silenced and character.silence_turns_remaining > 0:
                character.silence_turns_remaining -= 1
                if character.silence_turns_remaining == 0:
                    character.is_silenced = False
