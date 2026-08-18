"""New faction-40 cards: effects and identity verbs."""

from engine.card import create_card_instance
from engine.game import Game
from engine.models import load_cards


def _by_id():
    return {c.id: c for c in load_cards("data/cards.json")}


def _game(card, opp=None):
    cards = _by_id()
    pawn = cards["templars_char_009"]
    game = Game.setup(
        [card] + [pawn] * 29,
        [opp or pawn] * 30,
        "A",
        "B",
        first_player=0,
        shuffle=False,
    )
    game.start_turn()
    game.active_player.energy = 10
    return game


class TestNewIlluminati:
    def test_leak_dump_discards_two(self):
        cards = _by_id()
        game = _game(cards["illuminati_spell_013"])
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "illuminati_spell_013")
        before = game.inactive_player.hand_size
        result = game.play_card(idx)
        assert result["success"] is True
        assert game.inactive_player.hand_size == max(0, before - 2)

    def test_quiet_extradition_bounces(self):
        cards = _by_id()
        game = _game(cards["illuminati_spell_012"])
        dummy = create_card_instance(cards["templars_char_009"], "e1", "B")
        game.inactive_player.board = [dummy]
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "illuminati_spell_012")
        result = game.play_card(idx, spell_target_index=0)
        assert result["success"] is True
        assert game.inactive_player.board == []


class TestNewTemplars:
    def test_novice_has_shield(self):
        cards = _by_id()
        inst = create_card_instance(cards["templars_char_015"], "n1", "A")
        assert inst.has_shield is True
        assert inst.take_damage(3) == 0

    def test_anoint_gives_shield(self):
        cards = _by_id()
        game = _game(cards["templars_spell_011"])
        ally = create_card_instance(cards["templars_char_009"], "a1", "A")
        game.active_player.board = [ally]
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "templars_spell_011")
        result = game.play_card(idx, spell_target_index=0, target_side="ally")
        assert result["success"] is True
        assert ally.has_shield is True


class TestNewReptilians:
    def test_brood_burst_summons_two(self):
        cards = _by_id()
        game = _game(cards["reptilians_spell_013"])
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "reptilians_spell_013")
        result = game.play_card(idx)
        assert result["success"] is True
        names = [c.name for c in game.active_player.board]
        assert names.count("Raptor") == 2

    def test_fang_brood_is_venom(self):
        cards = _by_id()
        inst = create_card_instance(cards["reptilians_char_016"], "f1", "A")
        assert inst.has_venom is True


class TestPoolCounts:
    def test_forty_per_faction(self):
        cards = load_cards("data/cards.json")
        for faction in ("illuminati", "templars", "reptilians"):
            n = len([c for c in cards if c.faction.value == faction])
            assert n == 40, f"{faction} has {n}"

    def test_network_is_one_twenty(self):
        cards = load_cards("data/cards.json")
        assert len([c for c in cards if c.faction.value == "neutral"]) == 120
