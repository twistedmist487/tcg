"""Tests for engine.combat — combat resolution."""

import pytest

from engine.card import create_card_instance, CardInstance
from engine.combat import CombatResult, can_attack_player_directly, resolve_attack
from engine.models import CharacterCard
from engine.player import Player


def _character(
    name="Test",
    attack=2,
    health=5,
    ability="None",
    faction="illuminati",
    energy="Influence",
) -> CharacterCard:
    faction_map = {
        "illuminati": ("illuminati", "Influence"),
        "templars": ("templars", "Faith"),
        "reptilians": ("reptilians", "Psionics"),
    }
    f, e = faction_map.get(faction, (faction, energy))
    return CharacterCard(
        id=f"{f}_char_001",
        name=name,
        faction=f,
        energy_type=e,
        cost=3,
        lore="lore",
        attack=attack,
        health=health,
        ability=ability,
    )


def _player(name="P1", deck_size=10) -> Player:
    deck = [
        _character(f"C{i}", attack=1, health=2) for i in range(deck_size)
    ]
    return Player(name, deck)


class TestResolveAttack:
    """Test character-to-character and direct attacks."""

    def test_basic_character_vs_character(self):
        atk = create_card_instance(_character("A", attack=3, health=4), "a1", "P1")
        atk.is_exhausted = False
        defs = create_card_instance(_character("D", attack=1, health=3, faction="templars"), "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")
        p1.board = [atk]
        p2.board = [defs]

        result = resolve_attack(atk, p1, p2, defs)

        assert result.damage_dealt_to_defender == 3
        assert result.damage_dealt_to_attacker == 1
        # defender health=3, takes 3 -> dead
        assert defs.is_alive is False
        # attacker health=4, takes 1 -> 3 remaining
        assert atk.current_health == 3
        assert atk.is_exhausted is True  # attacker exhausted after attack

    def test_mutual_kill(self):
        atk = create_card_instance(_character("Glass", attack=5, health=1), "a1", "P1")
        atk.is_exhausted = False
        defs = create_card_instance(_character("GlassD", attack=5, health=1, faction="templars"), "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")
        p1.board = [atk]
        p2.board = [defs]

        result = resolve_attack(atk, p1, p2, defs)

        assert result.attacker_died is True
        assert result.defender_died is True

    def test_direct_attack_on_player(self):
        atk = create_card_instance(_character("Smash", attack=6, health=3), "a1", "P1")
        atk.is_exhausted = False

        p1 = _player("P1")
        p2 = _player("P2")
        p2.life = 30
        p1.board = [atk]

        result = resolve_attack(atk, p1, p2, None)

        assert result.damage_dealt_to_defender == 6
        assert p2.life == 24
        assert result.defender is None
        assert atk.is_exhausted is True

    def test_exhausted_character_cannot_attack(self):
        atk = create_card_instance(_character("Tired", attack=3, health=5), "a1", "P1")
        atk.is_exhausted = True
        defs = create_card_instance(_character("Target", attack=1, health=3, faction="templars"), "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")

        with pytest.raises(ValueError, match="cannot attack"):
            resolve_attack(atk, p1, p2, defs)

    def test_stealth_breaks_on_attack(self):
        atk = create_card_instance(
            _character("Sneak", attack=2, health=2, ability="Stealth", faction="reptilians"),
            "a1", "P1"
        )
        atk.is_exhausted = False
        assert atk.is_stealth is True

        defs = create_card_instance(_character("Victim", attack=1, health=5, faction="templars"), "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")
        p1.board = [atk]
        p2.board = [defs]

        resolve_attack(atk, p1, p2, defs)
        assert atk.is_stealth is False

    def test_zero_attack_cannot_attack(self):
        card = _character("Weak", attack=0, health=5)
        atk = create_card_instance(card, "a1", "P1")
        atk.is_exhausted = False
        defs = _character("Target", attack=1, health=3, faction="templars")
        defs_inst = create_card_instance(defs, "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")

        with pytest.raises(ValueError, match="cannot attack"):
            resolve_attack(atk, p1, p2, defs_inst)

    def test_dead_character_cannot_attack(self):
        card = _character("Dead", attack=3, health=1)
        atk = create_card_instance(card, "a1", "P1")
        atk.is_exhausted = False
        atk.take_damage(1)
        assert atk.is_alive is False

        defs = create_card_instance(_character("Target", attack=1, health=3, faction="templars"), "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")

        with pytest.raises(ValueError, match="cannot attack"):
            resolve_attack(atk, p1, p2, defs)

    def test_attacker_killed_by_retaliation(self):
        """Low-health attacker dies when fighting a high-attack defender."""
        atk = create_card_instance(_character("Fragile", attack=10, health=1), "a1", "P1")
        atk.is_exhausted = False

        card_d = _character("Tough", attack=10, health=12, faction="templars")
        defs = create_card_instance(card_d, "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")
        p1.board = [atk]
        p2.board = [defs]

        result = resolve_attack(atk, p1, p2, defs)

        assert result.attacker_died is True
        assert result.defender_died is False

    def test_combat_result_repr(self):
        atk_card = _character("A", attack=2, health=3)
        atk = create_card_instance(atk_card, "a1", "P1")
        atk.is_exhausted = False

        defs_card = _character("D", attack=1, health=3, faction="templars")
        defs = create_card_instance(defs_card, "d1", "P2")

        p1 = _player("P1")
        p2 = _player("P2")
        p1.board = [atk]
        p2.board = [defs]

        result = resolve_attack(atk, p1, p2, defs)
        repr_str = repr(result)
        assert "A" in repr_str


class TestFaceThroughStealth:
    def test_stealth_only_board_allows_face(self):
        sneak = create_card_instance(
            _character("Ghost", attack=1, health=2, ability="Stealth", faction="reptilians"),
            "s1",
            "P2",
        )
        p1 = _player("P1")
        p2 = _player("P2")
        p2.board = [sneak]
        assert can_attack_player_directly(p1, p2) is True

    def test_visible_minion_blocks_face(self):
        blocker = create_card_instance(_character("Wall", attack=1, health=2), "w1", "P2")
        p1 = _player("P1")
        p2 = _player("P2")
        p2.board = [blocker]
        assert can_attack_player_directly(p1, p2) is False

    def test_empty_board_allows_face(self):
        p1 = _player("P1")
        p2 = _player("P2")
        assert can_attack_player_directly(p1, p2) is True
