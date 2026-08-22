"""Faction powers — once per turn, cost 2."""

from engine.ai import AIPlayer, choose_action, execute_turn
from engine.card import create_card_instance
from engine.game import Game
from engine.hero_power import power_for
from engine.models import CharacterCard, load_factions


def _char(name="Pawn", attack=1, health=2, faction="templars", ability="None"):
    energy = {"illuminati": "Influence", "templars": "Faith", "reptilians": "Psionics"}[faction]
    return CharacterCard(
        id=f"{faction}_char_999",
        name=name,
        faction=faction,
        energy_type=energy,
        cost=1,
        lore="test",
        attack=attack,
        health=health,
        ability=ability,
    )


def _game(p1="illuminati", p2="reptilians"):
    from engine.models import load_cards

    cards = load_cards("data/cards.json")
    d1 = [c for c in cards if c.faction.value == p1][:8] * 2
    d2 = [c for c in cards if c.faction.value == p2][:8] * 2
    game = Game.setup(d1, d2, "Alice", "Bob", first_player=0, shuffle=False, player1_faction=p1, player2_faction=p2)
    return game


class TestPowerData:
    def test_all_playable_factions_have_a_power(self):
        factions = load_factions("data/factions.json")
        for key in ("illuminati", "templars", "reptilians"):
            power = factions[key].hero_power
            assert power is not None
            assert power.cost == 2
            assert power.name
            assert power.effect

    def test_network_has_no_power(self):
        assert power_for("neutral") is None

    def test_lookup(self):
        assert power_for("illuminati").id == "pull_strings"
        assert power_for("templars").id == "call_initiate"
        assert power_for("reptilians").id == "psi_lash"


class TestUseHeroPower:
    def test_requires_started_turn(self):
        game = _game()
        result = game.use_hero_power()
        assert result["success"] is False

    def test_costs_two_and_once_per_turn(self):
        game = _game("reptilians", "templars")
        game.start_turn()
        game.active_player.energy = 3
        game.active_player.max_energy = 3
        before = game.inactive_player.life
        first = game.use_hero_power()
        assert first["success"] is True
        assert game.active_player.energy == 1
        assert game.inactive_player.life == before - 2
        second = game.use_hero_power()
        assert second["success"] is False
        assert game.active_player.energy == 1

    def test_resets_next_turn(self):
        game = _game("reptilians", "templars")
        game.start_turn()
        game.active_player.energy = 2
        game.use_hero_power()
        game.end_turn()
        game.start_turn()  # Bob
        game.end_turn()
        game.start_turn()  # Alice again
        game.active_player.energy = 4
        result = game.use_hero_power()
        assert result["success"] is True

    def test_templars_summon_taunt_initiate(self):
        game = _game("templars", "illuminati")
        game.start_turn()
        game.active_player.energy = 2
        result = game.use_hero_power()
        assert result["success"] is True
        assert len(game.active_player.board) == 1
        initiate = game.active_player.board[0]
        assert initiate.name == "Initiate"
        assert initiate.has_taunt is True
        assert initiate.current_attack == 1
        assert initiate.current_health == 1
        assert initiate.is_exhausted is True

    def test_templars_board_full_does_not_spend(self):
        game = _game("templars", "illuminati")
        game.start_turn()
        player = game.active_player
        player.energy = 2
        for i in range(7):
            inst = create_card_instance(_char(name=f"W{i}"), f"w{i}", player.name)
            player.board.append(inst)
        result = game.use_hero_power()
        assert result["success"] is False
        assert player.energy == 2
        assert player.hero_power_used is False
        assert len(player.board) == 7

    def test_illuminati_pings_face(self):
        game = _game("illuminati", "reptilians")
        game.start_turn()
        game.active_player.energy = 2
        before = game.inactive_player.life
        result = game.use_hero_power(target_side="face")
        assert result["success"] is True
        assert game.inactive_player.life == before - 1

    def test_illuminati_pings_character_and_can_kill(self):
        game = _game("illuminati", "reptilians")
        game.start_turn()
        opp = game.inactive_player
        chick = create_card_instance(_char(name="Hatchling", attack=1, health=1, faction="reptilians"), "h1", opp.name)
        opp.board.append(chick)
        game.active_player.energy = 2
        result = game.use_hero_power(target_index=0, target_side="enemy")
        assert result["success"] is True
        assert all(c.name != "Hatchling" for c in opp.board)

    def test_not_enough_energy(self):
        game = _game("reptilians", "templars")
        game.start_turn()
        game.active_player.energy = 1
        result = game.use_hero_power()
        assert result["success"] is False

    def test_state_exposes_power(self):
        game = _game("templars", "reptilians")
        game.start_turn()
        game.active_player.energy = 2
        state = game.get_state()
        me = state["players"][0]
        assert me["hero_power"]["name"] == "Call Initiate"
        assert me["hero_power"]["available"] is True
        game.use_hero_power()
        state = game.get_state()
        assert state["players"][0]["hero_power"]["used"] is True
        assert state["players"][0]["hero_power"]["available"] is False


class TestHeroPowerAI:
    def test_easy_does_not_use_power(self):
        game = _game("reptilians", "templars")
        game.start_turn()
        game.active_player.energy = 2
        game.active_player.hand.clear()
        game.active_player.board.clear()
        ai = AIPlayer(name="Bob", faction="reptilians", difficulty="easy")
        action = choose_action(game, ai)
        assert action["action"] != "hero_power"

    def test_medium_reptilian_uses_psi_lash_when_idle(self):
        game = _game("reptilians", "templars")
        game.start_turn()
        player = game.active_player
        player.energy = 2
        player.hand.clear()
        player.board.clear()
        ai = AIPlayer(name="Alice", faction="reptilians", difficulty="medium")
        action = choose_action(game, ai)
        assert action["action"] == "hero_power"

    def test_execute_turn_can_fire_power(self):
        game = _game("reptilians", "templars")
        game.start_turn()
        player = game.active_player
        player.energy = 2
        player.hand.clear()
        player.board.clear()
        before = game.inactive_player.life
        victim = game.inactive_player
        ai = AIPlayer(name="Alice", faction="reptilians", difficulty="medium")
        results = execute_turn(game, ai)
        kinds = [r["action"] for r in results]
        assert "hero_power" in kinds
        assert victim.life == before - 2
