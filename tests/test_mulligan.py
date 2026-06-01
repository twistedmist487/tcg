"""Tests for mulligan system."""

from engine.game import Game
from engine.models import CharacterCard, load_cards


def _make_game(p1_faction="illuminati", p2_faction="templars"):
    """Create a test game with 20-card decks per faction."""
    cards = load_cards("data/cards.json")
    deck1 = [c for c in cards if c.faction.value == p1_faction][:10]
    deck1 = deck1 * 2
    deck2 = [c for c in cards if c.faction.value == p2_faction][:10]
    deck2 = deck2 * 2
    return Game.setup(deck1, deck2, "Alice", "Bob")


def _char_card(name="TestChar", cost=2, attack=2, health=3, faction="illuminati", ability="None"):
    energy = {"illuminati": "Influence", "templars": "Faith", "reptilians": "Psionics"}.get(
        faction, "Influence"
    )
    return CharacterCard(
        id=f"{faction}_char_999",
        name=name,
        faction=faction,
        energy_type=energy,
        cost=cost,
        lore="test",
        attack=attack,
        health=health,
        ability=ability,
    )


class TestMulligan:
    def test_basic_mulligan(self):
        """Player mulligans 2 cards, gets 2 new ones."""
        game = _make_game()
        player = game.players[0]
        hand_before = [c.name for c in player.hand]
        assert len(hand_before) == 4

        # Mulligan first 2 cards
        result = game.mulligan(player.name, [0, 1])
        assert result["success"] is True
        assert len(result["mulliganed"]) == 2
        assert len(result["drawn"]) == 2
        assert result["hand_size"] == 4  # still 4 cards

    def test_mulligan_empty_keeps_hand(self):
        """Mulligan with no indices keeps the whole hand."""
        game = _make_game()
        player = game.players[0]

        result = game.mulligan(player.name, [])
        assert result["success"] is True
        assert len(result["mulliganed"]) == 0
        assert len(result["drawn"]) == 0
        assert result["hand_size"] == 4

    def test_mulligan_all_four(self):
        """Mulligan all 4 cards."""
        game = _make_game()
        player = game.players[0]

        result = game.mulligan(player.name, [0, 1, 2, 3])
        assert result["success"] is True
        assert len(result["mulliganed"]) == 4
        assert len(result["drawn"]) == 4
        assert result["hand_size"] == 4

    def test_cannot_mulligan_twice(self):
        """Player can only mulligan once."""
        game = _make_game()
        player = game.players[0]

        result1 = game.mulligan(player.name, [0])
        assert result1["success"] is True

        result2 = game.mulligan(player.name, [0])
        assert result2["success"] is False
        assert "already mulliganed" in result2["error"]

    def test_cannot_mulligan_after_turn_start(self):
        """Mulligan is only available before the first turn."""
        game = _make_game()
        game.start_turn()

        result = game.mulligan(game.players[0].name, [0])
        assert result["success"] is False
        assert "only available before the first turn" in result["error"]

    def test_both_players_can_mulligan(self):
        """Both players can mulligan independently."""
        game = _make_game()

        result1 = game.mulligan(game.players[0].name, [0, 1])
        result2 = game.mulligan(game.players[1].name, [0])

        assert result1["success"] is True
        assert result2["success"] is True
        assert game.both_players_mulliganed is True

    def test_mulligan_invalid_index(self):
        """Invalid hand index returns error."""
        game = _make_game()
        player = game.players[0]

        result = game.mulligan(player.name, [10])
        assert result["success"] is False
        assert "Invalid hand index" in result["error"]

    def test_mulligan_unknown_player(self):
        """Unknown player name returns error."""
        game = _make_game()

        result = game.mulligan("Nobody", [0])
        assert result["success"] is False
        assert "not found" in result["error"]

    def test_mulligan_preserves_deck_size(self):
        """Total cards (hand + deck) should be preserved after mulligan."""
        game = _make_game()
        player = game.players[0]

        total_before = len(player.hand) + len(player.deck)
        game.mulligan(player.name, [0, 1])
        total_after = len(player.hand) + len(player.deck)

        assert total_before == total_after

    def test_mulligan_removes_correct_cards(self):
        """The specific cards selected are the ones mulliganed."""
        game = _make_game()
        player = game.players[0]
        hand_names = [c.name for c in player.hand]

        result = game.mulligan(player.name, [0, 2])
        # Cards are returned in reverse index order (popped high to low)
        assert set(result["mulliganed"]) == {hand_names[0], hand_names[2]}

    def test_mulligan_deduplicates_indices(self):
        """Duplicate indices are handled gracefully."""
        game = _make_game()
        player = game.players[0]

        result = game.mulligan(player.name, [0, 0, 1])
        # Should only mulligan 2 unique cards
        assert len(result["mulliganed"]) == 2

    def test_both_players_mulliganed_property(self):
        """both_players_mulliganed reflects state correctly."""
        game = _make_game()
        assert game.both_players_mulliganed is False

        game.mulligan(game.players[0].name, [])
        assert game.both_players_mulliganed is False

        game.mulligan(game.players[1].name, [])
        assert game.both_players_mulliganed is True

    def test_mulligan_logs_to_history(self):
        """Mulligan action is logged to game history."""
        game = _make_game()
        player = game.players[0]

        game.mulligan(player.name, [0])
        mulligan_actions = [h for h in game.history if h["action"] == "mulligan"]
        assert len(mulligan_actions) == 1


class TestMulliganEndpoint:
    """Test the mulligan REST endpoint."""

    def test_mulligan_via_api(self):
        from starlette.testclient import TestClient

        from server.app import app

        tc = TestClient(app)

        # Create a game
        resp = tc.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = resp.json()["session_id"]

        # Mulligan
        resp = tc.post(
            f"/api/game/{session_id}/mulligan?player_name=Test",
            json=[0, 1],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["mulligan_result"]["success"] is True

    def test_mulligan_fails_after_turn_start(self):
        from starlette.testclient import TestClient

        from server.app import app

        tc = TestClient(app)

        resp = tc.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = resp.json()["session_id"]

        # Start the turn first
        tc.post(f"/api/game/{session_id}/start-turn")

        # Mulligan should fail
        resp = tc.post(
            f"/api/game/{session_id}/mulligan?player_name=Test",
            json=[0],
        )
        assert resp.status_code == 400
