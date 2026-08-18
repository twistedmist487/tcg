"""Keyword systems: Shielding, Assault, Deathrattle, Rush, Enraged, Discovery."""

from engine.card import create_card_instance, prefix_keywords
from engine.game import Game
from engine.models import CharacterCard, SpellCard, load_cards


def _fill(card, n=30):
    return [card] * n


def _by_id():
    return {c.id: c for c in load_cards("data/cards.json")}


class TestPrefixKeywords:
    def test_stacked_prefixes(self):
        assert prefix_keywords("Charge. Stealth. When this attacks.") == {"Charge", "Stealth"}

    def test_solo_taunt(self):
        assert prefix_keywords("Taunt") == {"Taunt"}
        assert prefix_keywords("Taunt.") == {"Taunt"}

    def test_gains_stealth_is_not_prefix(self):
        assert "Stealth" not in prefix_keywords(
            "When played, if you are Reptilians, this gains Stealth."
        )


class TestShielding:
    def test_absorbs_then_pops(self):
        cards = _by_id()
        barrier = cards["neutral_char_009"]
        pawn = cards["templars_char_009"]
        inst = create_card_instance(barrier, "b1", "A")
        assert inst.has_shield is True
        assert inst.take_damage(4) == 0
        assert inst.has_shield is False
        assert inst.current_health == barrier.health
        assert inst.take_damage(1) == 1
        assert inst.current_health == barrier.health - 1

    def test_hero_shield(self):
        cards = _by_id()
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(pawn), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.players[0].has_shield = True
        before = game.players[0].life
        assert game.players[0].direct_damage(5) == 0
        assert game.players[0].life == before
        assert game.players[0].has_shield is False
        assert game.players[0].direct_damage(5) == 5
        assert game.players[0].life == before - 5


class TestRushAndCharge:
    def test_rush_can_hit_minion_not_face(self):
        cards = _by_id()
        runner = cards["neutral_char_010"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(runner), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "neutral_char_010")
        game.play_card(idx)
        runner_i = game.active_player.board[-1]
        assert runner_i.has_rush
        assert runner_i.rush_locked
        assert runner_i.is_exhausted is False
        face = game.attack(len(game.active_player.board) - 1, None)
        assert face["success"] is False
        assert "Rush" in face["error"]

    def test_charge_can_hit_face(self):
        cards = _by_id()
        zealot = cards["templars_char_012"]
        pawn = cards["templars_char_009"]
        game = Game.setup([zealot] + [pawn] * 29, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "templars_char_012")
        game.play_card(idx)
        before = game.inactive_player.life
        struck = game.attack(len(game.active_player.board) - 1, None)
        assert struck["success"] is True
        assert game.inactive_player.life < before


class TestEnraged:
    def test_can_attack_twice(self):
        cards = _by_id()
        rage = cards["neutral_char_011"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(rage), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "neutral_char_011")
        game.play_card(idx)
        # Enraged without Charge/Rush is exhausted the turn played
        inst = game.active_player.board[-1]
        assert inst.has_enraged
        inst.is_exhausted = False
        first = game.attack(0, None)
        assert first["success"] is True
        assert inst.is_exhausted is False
        second = game.attack(0, None)
        assert second["success"] is True
        assert inst.is_exhausted is True


class TestAssault:
    def test_strike_asset_damages_target(self):
        cards = _by_id()
        strike = cards["neutral_char_012"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(strike), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        from engine.card import create_card_instance

        dummy = create_card_instance(pawn, "e1", "B")
        dummy.is_exhausted = True
        game.inactive_player.board = [dummy]
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "neutral_char_012")
        result = game.play_card(idx, spell_target_index=0)
        assert result["success"] is True
        assert dummy.current_health == pawn.health - 2


class TestDeathrattle:
    def test_hatchling_summons_raptor(self):
        cards = _by_id()
        brood = cards["reptilians_char_007"]
        smite = cards["templars_spell_001"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(smite), _fill(brood), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        from engine.card import create_card_instance

        chick = create_card_instance(brood, "h1", "B")
        game.inactive_player.board = [chick]
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.type.value == "Spell")
        game.play_card(idx, spell_target_index=0)
        names = [c.name for c in game.inactive_player.board]
        assert "Hatchling Brood" not in names
        assert "Raptor" in names

    def test_zealot_pings_hero_on_death(self):
        cards = _by_id()
        zealot = cards["templars_char_012"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(pawn), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        from engine.card import create_card_instance

        z = create_card_instance(zealot, "z1", "A")
        z.is_exhausted = False
        z.take_damage(10)
        assert z.is_alive is False
        game.active_player.board = [z]
        before = game.inactive_player.life
        game._resolve_deaths()
        assert game.inactive_player.life == before - 2
        assert game.active_player.board == []


class TestDiscovery:
    def test_open_channel_offers_three_then_adds(self):
        cards = _by_id()
        channel = cards["neutral_spell_005"]
        pawn = cards["templars_char_009"]
        game = Game.setup(
            [channel] + [pawn] * 29,
            [pawn] * 30,
            "A",
            "B",
            first_player=0,
            shuffle=False,
            player1_faction="templars",
        )
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == "neutral_spell_005")
        result = game.play_card(idx)
        assert result["success"] is True
        assert game.pending_discovery is not None
        assert len(game.pending_discovery["cards"]) == 3
        for card in game.pending_discovery["cards"]:
            assert card.faction.value in ("templars", "neutral")
        before = game.active_player.hand_size
        picked = game.choose_discovery(0)
        assert picked["success"] is True
        assert game.pending_discovery is None
        assert game.active_player.hand_size == before + 1
