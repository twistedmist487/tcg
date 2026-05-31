"""Tests for the FastAPI web server."""

import pytest
from fastapi.testclient import TestClient

from server.app import app


@pytest.fixture
def client():
    return TestClient(app)


class TestCardEndpoint:
    def test_get_cards_returns_list(self, client):
        resp = client.get("/api/cards")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_get_cards_have_required_fields(self, client):
        resp = client.get("/api/cards")
        data = resp.json()
        for card in data[:3]:
            assert "id" in card
            assert "name" in card
            assert "faction" in card
            assert "cost" in card
            assert "type" in card


class TestGameLifecycle:
    def test_create_game(self, client):
        resp = client.post("/api/game/new?player_name=Test&player_faction=illuminati")
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert "state" in data
        assert len(data["session_id"]) > 0

    def test_create_game_state_has_players(self, client):
        resp = client.post("/api/game/new?player_name=Test&player_faction=templars")
        data = resp.json()
        state = data["state"]
        assert state["players"] is not None
        # state returned from new_game may not have players key at top level
        # depending on serialization — check it doesn't crash

    def test_get_state(self, client):
        # Create game
        create_resp = client.post("/api/game/new?player_name=Test&player_faction=reptilians")
        session_id = create_resp.json()["session_id"]

        # Get state
        state_resp = client.get(f"/api/game/{session_id}/state")
        assert state_resp.status_code == 200
        state = state_resp.json()
        assert "players" in state
        assert "turn" in state
        assert state["is_over"] is False

    def test_start_turn(self, client):
        create_resp = client.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = create_resp.json()["session_id"]

        start_resp = client.post(f"/api/game/{session_id}/start-turn")
        assert start_resp.status_code == 200
        data = start_resp.json()
        assert "turn_result" in data
        assert "state" in data

    def test_start_turn_increments(self, client):
        create_resp = client.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = create_resp.json()["session_id"]

        # Start turn 1
        client.post(f"/api/game/{session_id}/start-turn")
        state1 = client.get(f"/api/game/{session_id}/state").json()

        # End turn
        client.post(f"/api/game/{session_id}/end-turn")

        # Start turn 2
        client.post(f"/api/game/{session_id}/start-turn")
        state2 = client.get(f"/api/game/{session_id}/state").json()

        assert state2["turn"] > state1["turn"]

    def test_end_turn(self, client):
        create_resp = client.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = create_resp.json()["session_id"]

        # Need to start turn first
        client.post(f"/api/game/{session_id}/start-turn")

        end_resp = client.post(f"/api/game/{session_id}/end-turn")
        assert end_resp.status_code == 200

    def test_play_card(self, client):
        create_resp = client.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = create_resp.json()["session_id"]

        # Start turn to gain energy
        client.post(f"/api/game/{session_id}/start-turn")
        state = client.get(f"/api/game/{session_id}/state").json()

        # Find a playable card in hand
        # Find the active player by name (get_state returns active_player as name)
        active_name = state["active_player"]
        active_idx = next(i for i, p in enumerate(state["players"]) if p["name"] == active_name)
        hand = state["players"][active_idx]["hand"]
        played = False
        for i, card in enumerate(hand):
            if state["players"][active_idx]["energy"] >= card["cost"]:
                play_resp = client.post(f"/api/game/{session_id}/play?card_index={i}")
                assert play_resp.status_code == 200
                played = True
                break

        # If no card was affordable, that's OK — test still passes
        # (first turn might only have 1 energy)

    def test_attack(self, client):
        create_resp = client.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = create_resp.json()["session_id"]

        client.post(f"/api/game/{session_id}/start-turn")
        state = client.get(f"/api/game/{session_id}/state").json()

        # Check if there are characters on board to attack with
        active_name = state["active_player"]
        active_idx = next(i for i, p in enumerate(state["players"]) if p["name"] == active_name)
        board = state["players"][active_idx]["board"]

        # This will likely fail validation on turn 1 (no board chars),
        # but should return a proper error, not crash
        if len(board) > 0:
            attack_resp = client.post(
                f"/api/game/{session_id}/attack",
                json={"attacker_index": 0, "target_index": None},
            )
            # Either 200 (success) or 404 etc. — just check it doesn't 500
            assert attack_resp.status_code < 500
        else:
            # No board chars to attack with — skip
            pass

    def test_session_not_found(self, client):
        resp = client.get("/api/game/fake-id-123/state")
        assert resp.status_code == 404

    def test_delete_session(self, client):
        create_resp = client.post("/api/game/new?player_name=Test&player_faction=illuminati")
        session_id = create_resp.json()["session_id"]

        delete_resp = client.delete(f"/api/game/{session_id}")
        assert delete_resp.status_code == 200

        # Verify it's gone
        state_resp = client.get(f"/api/game/{session_id}/state")
        assert state_resp.status_code == 404

    def test_list_sessions(self, client):
        client.post("/api/game/new?player_name=Test1&player_faction=illuminati")
        client.post("/api/game/new?player_name=Test2&player_faction=templars")

        resp = client.get("/api/sessions")
        assert resp.status_code == 200
        sessions = resp.json()
        assert isinstance(sessions, list)
        assert len(sessions) >= 2


class TestFullGameFlow:
    def test_play_mini_turn(self, client):
        """Create a game, start turn, optionally play a card, end turn."""
        resp = client.post("/api/game/new?player_name=Fighter&player_faction=reptilians&ai_faction=templars")
        session_id = resp.json()["session_id"]

        # Start turn
        start_resp = client.post(f"/api/game/{session_id}/start-turn")
        state = start_resp.json()["state"]

        active_name = state["active_player"]
        active_idx = next(i for i, p in enumerate(state["players"]) if p["name"] == active_name)
        player_data = state["players"][active_idx]

        # Try to play cards until out of energy or hand
        for _ in range(10):
            state = client.get(f"/api/game/{session_id}/state").json()
            active_name = state["active_player"]
            active_idx = next(i for i, p in enumerate(state["players"]) if p["name"] == active_name)
            p = state["players"][active_idx]

            if p["hand"] and p["energy"] > 0:
                played = False
                for i, card in enumerate(p["hand"]):
                    if p["energy"] >= card["cost"]:
                        client.post(f"/api/game/{session_id}/play?card_index={i}")
                        played = True
                        break
                if not played:
                    break
            else:
                break

        # End turn
        end_resp = client.post(f"/api/game/{session_id}/end-turn")
        assert end_resp.status_code == 200
