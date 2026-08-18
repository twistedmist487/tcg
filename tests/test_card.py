"""Tests for engine.card — CardInstance runtime state."""

import pytest

from engine.card import CardInstance, create_card_instance
from engine.models import CharacterCard, SpellCard, LocationCard


class TestCardInstance:
    """Tests for the CardInstance mutable runtime wrapper."""

    def _make_character(self, **overrides) -> CharacterCard:
        defaults = {
            "id": "illuminati_char_001",
            "name": "Test Character",
            "type": "Character",
            "faction": "illuminati",
            "energy_type": "Influence",
            "cost": 3,
            "lore": "Test lore.",
            "attack": 2,
            "health": 5,
            "ability": "Test ability.",
        }
        defaults.update(overrides)
        return CharacterCard(**defaults)

    def _make_instance(self, card=None, **overrides) -> CardInstance:
        if card is None:
            card = self._make_character()
        defaults = {
            "card": card,
            "instance_id": "test_001",
            "owner": "Player1",
        }
        defaults.update(overrides)
        return CardInstance(**defaults)

    # --- Creation & basic properties ---

    def test_character_instance_basic(self):
        card = self._make_character()
        inst = self._make_instance(card)
        assert inst.name == "Test Character"
        assert inst.current_attack == 2
        assert inst.current_health == 5
        assert inst.is_alive is True
        assert inst.can_attack is False  # default: exhausted
        assert inst.is_stealth is False
        assert inst.has_taunt is False

    def test_instance_enters_exhausted(self):
        """Characters enter exhausted by default."""
        card = self._make_character()
        inst = self._make_instance(card, is_exhausted=True)
        assert inst.can_attack is False

    def test_can_attack_when_active(self):
        """Non-exhausted characters with attack > 0 can attack."""
        card = self._make_character()
        inst = self._make_instance(card, is_exhausted=False)
        assert inst.can_attack is True

    def test_cannot_attack_with_zero_attack(self):
        card = self._make_character(attack=0)
        inst = self._make_instance(card, is_exhausted=False)
        assert inst.can_attack is False

    def test_dead_character_cannot_attack(self):
        card = self._make_character(health=3)
        inst = self._make_instance(card, is_exhausted=False, damage_taken=3)
        assert inst.is_alive is False
        assert inst.can_attack is False

    # --- Damage ---

    def test_take_damage(self):
        inst = self._make_instance()
        inst.take_damage(2)
        assert inst.damage_taken == 2
        assert inst.current_health == 3

    def test_take_fatal_damage(self):
        inst = self._make_instance()
        inst.take_damage(5)
        assert inst.is_alive is False
        assert inst.current_health == 0

    def test_take_overkill_damage(self):
        inst = self._make_instance()
        inst.take_damage(100)
        assert inst.is_alive is False
        assert inst.current_health == 0

    def test_negative_damage_raises(self):
        inst = self._make_instance()
        with pytest.raises(ValueError, match="non-negative"):
            inst.take_damage(-1)

    # --- Healing ---

    def test_heal(self):
        inst = self._make_instance()
        inst.take_damage(3)
        inst.heal(1)
        assert inst.damage_taken == 2
        assert inst.current_health == 3

    def test_heal_capped_at_damage_taken(self):
        inst = self._make_instance()
        inst.take_damage(1)
        inst.heal(10)
        assert inst.damage_taken == 0
        assert inst.current_health == 5

    def test_heal_when_full_health_is_zero(self):
        inst = self._make_instance()
        healed = inst.heal(5)
        assert healed == 0
        assert inst.current_health == 5

    # --- Attack buffs/debuffs ---

    def test_attack_buff(self):
        inst = self._make_instance()
        inst.modify_attack(2)
        assert inst.current_attack == 4

    def test_attack_debuff(self):
        inst = self._make_instance()
        inst.modify_attack(-1)
        assert inst.current_attack == 1

    def test_attack_never_negative(self):
        inst = self._make_instance()
        inst.modify_attack(-100)
        assert inst.current_attack == 0

    # --- Health buffs ---

    def test_health_buff(self):
        inst = self._make_instance()
        inst.modify_health(2)
        assert inst.current_health == 7
        inst.take_damage(3)
        assert inst.current_health == 4

    # --- Combat state ---

    def test_mark_for_combat(self):
        inst = self._make_instance(is_exhausted=False)
        inst.mark_for_combat()
        assert inst.is_exhausted is True

    def test_silence_and_unsilence(self):
        inst = self._make_instance()
        inst.silence()
        assert inst.is_silenced is True
        inst.unsilence()
        assert inst.is_silenced is False

    def test_remove_stealth(self):
        inst = self._make_instance(is_stealth=True)
        inst.remove_stealth()
        assert inst.is_stealth is False

    def test_clear_temp_buffs(self):
        inst = self._make_instance()
        inst.modify_attack(3)
        inst.modify_health(2)
        inst.buffs = ["buff1", "buff2"]
        inst.clear_temp_buffs()
        assert inst.attack_bonus == 0
        assert inst.health_bonus == 0
        assert inst.buffs == []


class TestCreateCardInstance:
    """Test the create_card_instance factory."""

    def test_character_gets_exhausted(self):
        card = CharacterCard(
            id="illuminati_char_001",
            name="Test",
            faction="illuminati",
            energy_type="Influence",
            cost=3,
            lore="lore",
            attack=2,
            health=3,
            ability="ability",
        )
        inst = create_card_instance(card, "p1_1", "Alice")
        assert inst.is_exhausted is True
        assert inst.owner == "Alice"

    def test_detect_taunt(self):
        card = CharacterCard(
            id="templars_char_001",
            name="Guardian",
            faction="templars",
            energy_type="Faith",
            cost=2,
            lore="lore",
            attack=1,
            health=4,
            ability="Taunt",
        )
        inst = create_card_instance(card, "p1_1", "Bob")
        assert inst.has_taunt is True

    def test_detect_stealth(self):
        card = CharacterCard(
            id="reptilians_char_001",
            name="Sneaky",
            faction="reptilians",
            energy_type="Psionics",
            cost=3,
            lore="lore",
            attack=2,
            health=2,
            ability="Stealth",
        )
        inst = create_card_instance(card, "p1_1", "Bob")
        assert inst.is_stealth is True

    def test_detect_charge_skips_exhaustion(self):
        card = CharacterCard(
            id="templars_char_012",
            name="Zealot",
            faction="templars",
            energy_type="Faith",
            cost=3,
            lore="lore",
            attack=3,
            health=2,
            ability="Charge. When this character dies, deal 2 damage to the enemy hero.",
        )
        inst = create_card_instance(card, "p1_1", "Alice")
        assert inst.has_charge is True
        assert inst.is_exhausted is False
