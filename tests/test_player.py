"""Tests for engine.player — player state management."""

import pytest

from engine.models import CharacterCard
from engine.player import Player


def _char(name="C", cost=1, attack=1, health=2, faction="illuminati"):
    energy = {"illuminati": "Influence", "templars": "Faith", "reptilians": "Psionics"}.get(faction, "Influence")
    return CharacterCard(
        id=f"{faction}_char_001", name=name, faction=faction, energy_type=energy,
        cost=cost, lore="l", attack=attack, health=health, ability="None",
    )


class TestPlayer:
    def test_creation(self):
        p = Player("Alice", [_char()])
        assert p.name == "Alice"
        assert p.life == 30
        assert p.energy == 0
        assert p.max_energy == 1

    def test_shuffle_deck(self):
        cards = [_char(f"C{i}") for i in range(10)]
        p = Player("Test", cards)
        p.shuffle_deck()
        assert len(p.deck) == 10

    def test_draw_starting_hand(self):
        p = Player("Test", [_char(f"C{i}") for i in range(20)])
        p.shuffle_deck()
        p.draw_starting_hand()
        assert p.hand_size == 4
        assert p.deck_size == 16

    def test_draw_card(self):
        p = Player("Test", [_char("A"), _char("B")])
        card = p.draw_card()
        assert card is not None
        assert p.hand_size == 1
        assert p.deck_size == 1

    def test_draw_from_empty_deck_fatigue(self):
        p = Player("Test", [])
        result = p.draw_card()
        assert result is None
        assert p.fatigue_damage == 1
        assert p.life == 29

    def test_fatigue_escalates(self):
        p = Player("Test", [])
        p.draw_card()
        p.draw_card()
        p.draw_card()
        assert p.fatigue_damage == 3
        assert p.life == 24

    def test_can_play_card(self):
        p = Player("Test", [])
        card = _char(cost=3)
        p.energy = 3
        assert p.can_play_card(card) is True
        p.energy = 2
        assert p.can_play_card(card) is False

    def test_spend_energy(self):
        p = Player("Test", [])
        p.energy = 5
        assert p.spend_energy(3) is True
        assert p.energy == 2
        assert p.spend_energy(3) is False
        assert p.energy == 2  # unchanged

    def test_increase_max_energy_capped(self):
        p = Player("Test", [])
        for i in range(25):
            p.increase_max_energy(1)
        assert p.max_energy == 20  # capped

    def test_refresh_energy(self):
        p = Player("Test", [])
        p.max_energy = 5
        p.energy = 2
        p.refresh_energy()
        assert p.energy == 5

    def test_play_character_from_hand(self):
        card = _char("Warrior", cost=2, attack=3, health=4)
        p = Player("Test", [card])
        p.draw_card()  # put it in hand
        p.energy = 2
        result = p.play_card(card)
        assert result is not None
        assert p.board_size == 1
        assert p.hand_size == 0
        assert p.energy == 0
        # Character enters exhausted
        assert result.is_exhausted is True

    def test_board_limit(self):
        cards = [_char(f"C{i}", cost=0) for i in range(10)]
        p = Player("Test", cards)
        p.draw_starting_hand()  # 4 in hand
        # Draw more
        for _ in range(6):
            p.draw_card()
        p.energy = 100
        played = 0
        while p.hand_size > 0:
            result = p.play_card(p.hand[0])
            if result is None:
                break
            played += 1
        assert played == 7
        assert p.board_size == 7

    def test_remove_dead_characters(self):
        card = _char("Fragile", cost=0, health=1)
        p = Player("Test", [card])
        p.draw_card()
        inst = p.play_card(card)
        inst.is_exhausted = False
        inst.take_damage(1)
        assert inst.is_alive is False
        dead = p.remove_dead_characters()
        assert len(dead) == 1
        assert len(p.board) == 0

    def test_is_dead(self):
        p = Player("Test", [])
        p.life = 0
        assert p.is_dead is True
        p.life = 1
        assert p.is_dead is False

    def test_get_attackable_characters(self):
        card1 = _char("A", cost=0, attack=2, health=3)
        card2 = _char("B", cost=0, attack=0, health=5)
        p = Player("Test", [card1, card2])
        p.draw_card()
        p.draw_card()
        p.energy = 10
        inst1 = p.play_card(card1)
        inst2 = p.play_card(card2)
        inst1.is_exhausted = False
        inst2.is_exhausted = False
        attackable = p.get_attackable_characters()
        assert len(attackable) == 1
        assert attackable[0].name == "A"

    def test_max_hand_size(self):
        """Cards drawn when hand is full are burned."""
        deck = [_char(f"D{i}") for i in range(20)]
        p = Player("Test", deck)
        # Draw starting hand
        p.draw_starting_hand()
        # Draw to fill hand to 10
        while p.hand_size < 10:
            p.draw_card()
        # Now deck still has cards, but hand is full
        assert p.hand_size == 10
        initial_hand = list(p.hand)
        burned = p.draw_card()
        assert burned is not None  # card was drawn but burned
        assert p.hand_size == 10

    def test_direct_damage(self):
        p = Player("Test", [])
        p.direct_damage(5)
        assert p.life == 25

    def test_negative_spend_raises(self):
        p = Player("Test", [])
        with pytest.raises(ValueError):
            p.spend_energy(-1)

    def test_negative_damage_raises(self):
        p = Player("Test", [])
        with pytest.raises(ValueError):
            p.direct_damage(-1)

    def test_not_enough_energy(self):
        card = _char("Expensive", cost=5)
        p = Player("Test", [card])
        p.draw_card()
        p.energy = 2
        result = p.play_card(card)
        assert result is None
        assert p.hand_size == 1  # card stays in hand

    def test_play_card_not_in_hand(self):
        card = _char("Ghost", cost=1)
        p = Player("Test", [])
        result = p.play_card(card)
        assert result is None

    def test_end_turn_cleanup(self):
        card = _char("Buffed", cost=0, attack=1, health=5)
        p = Player("Test", [card])
        p.draw_card()
        p.energy = 10
        inst = p.play_card(card)
        inst.modify_attack(2)
        inst.modify_health(3)
        inst.buffs = ["atk_up"]
        p.end_turn_cleanup()
        assert inst.attack_bonus == 0
        assert inst.health_bonus == 0
        assert inst.buffs == []
