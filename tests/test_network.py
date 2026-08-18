"""Tests for The Network (neutral) card pool and faction-conditional effects."""

from engine.card import create_card_instance
from engine.decks import load_card_lookup, validate_deck
from engine.effects import resolve_on_play_ability, resolve_start_of_turn_locations
from engine.game import Game
from engine.models import load_cards
from engine.player import Player


def _cards_by_id():
    return {card.id: card for card in load_cards("data/cards.json")}


def _fill(card, n=30):
    return [card] * n


class TestNetworkData:
    def test_twelve_network_cards(self):
        cards = [c for c in load_cards("data/cards.json") if c.faction.value == "neutral"]
        assert len(cards) == 120
        types = {c.type.value for c in cards}
        assert types == {"Character", "Spell", "Location"}

    def test_network_uses_conspiracy_energy(self):
        for card in load_cards("data/cards.json"):
            if card.faction.value == "neutral":
                assert card.energy_type.value == "Conspiracy"


class TestFactionInference:
    def test_ignores_neutrals_when_inferring(self):
        by_id = _cards_by_id()
        deck = [by_id["templars_char_009"]] * 22 + [by_id["neutral_char_001"]] * 8
        assert Player.infer_faction(deck) == "templars"

    def test_player_keeps_explicit_faction(self):
        by_id = _cards_by_id()
        p = Player("A", [by_id["neutral_char_001"]] * 30, faction="reptilians")
        assert p.faction == "reptilians"


class TestConditionalEffects:
    def test_double_agent_draws_two_for_illuminati(self):
        by_id = _cards_by_id()
        squire = by_id["templars_char_009"]
        agent = by_id["neutral_char_004"]
        game = Game.setup(_fill(squire), _fill(squire), "A", "B", first_player=0, shuffle=False)
        game.players[0].faction = "illuminati"
        game.start_turn()
        inst = create_card_instance(agent, "da1", "A")
        game.players[0].board.append(inst)
        before = game.players[0].hand_size
        result = resolve_on_play_ability(game, "A", inst)
        assert result.success is True
        assert game.players[0].hand_size == before + 2

    def test_double_agent_draws_one_for_templars(self):
        by_id = _cards_by_id()
        squire = by_id["templars_char_009"]
        agent = by_id["neutral_char_004"]
        game = Game.setup(_fill(squire), _fill(squire), "A", "B", first_player=0, shuffle=False)
        game.players[0].faction = "templars"
        game.start_turn()
        inst = create_card_instance(agent, "da1", "A")
        game.players[0].board.append(inst)
        before = game.players[0].hand_size
        resolve_on_play_ability(game, "A", inst)
        assert game.players[0].hand_size == before + 1

    def test_relic_courier_heals_templars_only(self):
        by_id = _cards_by_id()
        squire = by_id["templars_char_009"]
        courier = by_id["neutral_char_005"]
        game = Game.setup(_fill(squire), _fill(squire), "A", "B", first_player=0, shuffle=False)
        game.players[0].faction = "templars"
        game.players[0].life = 20
        game.start_turn()
        inst = create_card_instance(courier, "rc1", "A")
        resolve_on_play_ability(game, "A", inst)
        assert game.players[0].life == 23

        game.players[0].faction = "illuminati"
        game.players[0].life = 20
        resolve_on_play_ability(game, "A", inst)
        assert game.players[0].life == 20

    def test_skinwalker_stealth_for_reptilians_only(self):
        by_id = _cards_by_id()
        squire = by_id["templars_char_009"]
        hire = by_id["neutral_char_006"]
        game = Game.setup(_fill(squire), _fill(squire), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        inst = create_card_instance(hire, "sw1", "A")
        game.players[0].faction = "reptilians"
        resolve_on_play_ability(game, "A", inst)
        assert inst.is_stealth is True

        inst2 = create_card_instance(hire, "sw2", "A")
        game.players[0].faction = "illuminati"
        resolve_on_play_ability(game, "A", inst2)
        assert inst2.is_stealth is False

    def test_exchange_pings_harder_for_reptilians(self):
        by_id = _cards_by_id()
        squire = by_id["templars_char_009"]
        exchange = by_id["neutral_loc_002"]
        game = Game.setup(_fill(squire), _fill(squire), "A", "B", first_player=0, shuffle=False)
        game.players[0].faction = "reptilians"
        game.players[0].location = create_card_instance(exchange, "ex1", "A")
        before = game.players[1].life
        resolve_start_of_turn_locations(game, game.players[0])
        assert game.players[1].life == before - 2

        game.players[0].faction = "templars"
        game.players[1].life = before
        resolve_start_of_turn_locations(game, game.players[0])
        assert game.players[1].life == before - 1

    def test_consecrated_tip_heals_templars(self):
        by_id = _cards_by_id()
        squire = by_id["templars_char_009"]
        tip = by_id["neutral_spell_004"]
        game = Game.setup(_fill(squire), _fill(squire), "A", "B", first_player=0, shuffle=False)
        game.players[0].faction = "templars"
        game.start_turn()
        game.players[0].life = 20
        game.players[0].energy = 10
        enemy = create_card_instance(squire, "e1", "B")
        game.players[1].board = [enemy]
        game.players[0].hand.append(tip)
        game.play_card(len(game.players[0].hand) - 1, spell_target_index=0)
        assert game.players[0].life == 23
        assert enemy.current_health == enemy.card.health - 3
