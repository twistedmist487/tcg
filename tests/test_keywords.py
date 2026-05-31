"""Tests for engine.keywords — keyword mechanics."""

import pytest

from engine.card import create_card_instance
from engine.keywords import (  # noqa: E501
    apply_exhausted,
    apply_silence,
    clear_all_exhaustion,
    clear_silence,
    get_valid_attack_targets,
    has_stealth,
    has_taunt,
    is_exhausted,
    is_silenced,
    remove_stealth,
)
from engine.models import CharacterCard
from engine.player import Player


def _char(name, attack=2, health=3, ability="None", faction="illuminati"):
    energy = {"illuminati": "Influence", "templars": "Faith", "reptilians": "Psionics"}.get(faction, "Influence")
    return CharacterCard(
        id=f"{faction}_char_001", name=name, faction=faction, energy_type=energy,
        cost=2, lore="l", attack=attack, health=health, ability=ability,
    )


def _player(name):
    deck = [_char(f"D{i}", attack=1, health=2) for i in range(10)]
    return Player(name, deck)


class TestTaunt:
    def test_has_taunt(self):
        card = _char("Guard", ability="Taunt", faction="templars")
        inst = create_card_instance(card, "t1", "P1")
        assert has_taunt(inst) is True

    def test_no_taunt(self):
        card = _char("Norm")
        inst = create_card_instance(card, "t1", "P1")
        assert has_taunt(inst) is False

    def test_taunt_forces_target(self):
        """Taunt character restricts valid targets to only Taunt characters."""
        taunt_card = _char("Guard", ability="Taunt", faction="templars")
        normal_card = _char("Norm", faction="templars")

        attacker = _player("P1")
        defender = _player("P2")

        taunt_inst = create_card_instance(taunt_card, "t1", "P2")
        normal_inst = create_card_instance(normal_card, "n1", "P2")
        normal_inst.is_exhausted = False
        taunt_inst.is_exhausted = False

        defender.board = [taunt_inst, normal_inst]

        targets = get_valid_attack_targets(attacker, defender)
        assert len(targets) == 1
        assert targets[0].name == "Guard"

    def test_no_taunt_on_defender(self):
        """Without Taunt, all targetable characters are valid."""
        card1 = _char("A", faction="templars")
        card2 = _char("B", faction="templars")
        attacker = _player("P1")
        defender = _player("P2")
        inst1 = create_card_instance(card1, "i1", "P2")
        inst2 = create_card_instance(card2, "i2", "P2")
        inst1.is_exhausted = False
        inst2.is_exhausted = False
        defender.board = [inst1, inst2]
        targets = get_valid_attack_targets(attacker, defender)
        assert len(targets) == 2


class TestStealth:
    def test_has_stealth(self):
        card = _char("Sneak", ability="Stealth", faction="reptilians")
        inst = create_card_instance(card, "s1", "P1")
        assert has_stealth(inst) is True

    def test_stealth_cannot_be_targeted(self):
        stealth_card = _char("Ghost", ability="Stealth", faction="reptilians")
        normal_card = _char("Norm", faction="templars")

        attacker = _player("P1")
        defender = _player("P2")

        stealth_inst = create_card_instance(stealth_card, "s1", "P2")
        normal_inst = create_card_instance(normal_card, "n1", "P2")
        normal_inst.is_exhausted = False
        stealth_inst.is_exhausted = False

        defender.board = [stealth_inst, normal_inst]

        targets = get_valid_attack_targets(attacker, defender)
        assert len(targets) == 1
        assert targets[0].name == "Norm"

    def test_stealth_broken_by_attack(self):
        card = _char("Sneak", ability="Stealth", faction="reptilians")
        inst = create_card_instance(card, "s1", "P1")
        assert inst.is_stealth is True
        remove_stealth(inst)
        assert inst.is_stealth is False

    def test_stealth_with_taunt_interaction(self):
        """Stealth character with Taunt doesn't force attacks (stealth wins)."""
        stealth_taunt = _char("Weird", ability="Stealth Taunt", faction="reptilians")
        normal = _char("Norm", faction="templars")

        attacker = _player("P1")
        defender = _player("P2")

        st_inst = create_card_instance(stealth_taunt, "st1", "P2")
        n_inst = create_card_instance(normal, "n1", "P2")
        st_inst.is_exhausted = False
        n_inst.is_exhausted = False
        defender.board = [st_inst, n_inst]

        # Stealth character with Taunt text — stealth hides it, so
        # normal character becomes the only valid target
        targets = get_valid_attack_targets(attacker, defender)
        # Both stealth (untargetable) and taunt check:
        # stealth_taunt has both stealth and taunt — but stealth means it
        # cannot be targeted at all. So empty Taunt targets -> fall back to
        # non-stealth targets
        # Actually, the code filters stealth first, then checks for taunt
        # among remaining. Stealth-taunt gets filtered out by stealth check.
        # No taunt left among targetable -> returns all targetable (just "Norm")
        assert len(targets) == 1
        assert targets[0].name == "Norm"


class TestExhausted:
    def test_exhausted_default(self):
        card = _char("C")
        inst = create_card_instance(card, "e1", "P1")
        assert is_exhausted(inst) is True

    def test_apply_exhausted(self):
        card = _char("C")
        inst = create_card_instance(card, "e1", "P1")
        inst.is_exhausted = False
        apply_exhausted(inst)
        assert is_exhausted(inst) is True

    def test_clear_exhaustion(self):
        card = _char("C")
        inst = create_card_instance(card, "e1", "P1")
        game = type("Game", (), {"players": []})()
        clear_all_exhaustion(game, _player("P1"))
