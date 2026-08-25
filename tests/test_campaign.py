"""Tests for campaign crisis win condition and twist modifiers."""

from engine.card import create_card_instance
from engine.game import Game
from engine.models import load_cards
from engine.player import Player


def _tiny_game():
    cards = load_cards("data/cards.json")
    c = next(c for c in cards if c.id == "neutral_char_001")
    deck1 = [c] * 30
    deck2 = [c] * 30
    return Game.setup(deck1, deck2, "Recruit", "Inquisitor", shuffle=False, first_player=0)


def test_survive_turns_defender_wins_after_n_ends():
    game = _tiny_game()
    game.configure_match(
        win_condition="survive_turns",
        survive_turns=2,
        survive_defender="Recruit",
        crisis_label="Escape",
        lesson_win="You lived.",
    )
    assert game.winner is None
    # Recruit turn 1
    game.start_turn()
    game.end_turn()
    assert game.defender_turns_completed == 1
    assert game.winner is None
    # AI turn
    game.start_turn()
    game.end_turn()
    # Recruit turn 2 completes survival
    game.start_turn()
    game.end_turn()
    assert game.defender_turns_completed == 2
    assert game.winner == "Recruit"
    assert game.win_reason == "survive_turns"
    state = game.get_state()
    assert state["crisis"]["turns_completed"] == 2
    recap = game.get_recap("Recruit")
    assert recap["you_won"] is True
    assert recap["lesson"] == "You lived."


def test_survive_turns_loss_if_defender_dies():
    game = _tiny_game()
    game.configure_match(
        win_condition="survive_turns",
        survive_turns=5,
        survive_defender="Recruit",
        lesson_loss="Dead in the alley.",
    )
    recruit = next(p for p in game.players if p.name == "Recruit")
    recruit.life = 0
    game._check_win_condition()
    assert game.winner == "Inquisitor"
    assert game.win_reason == "defender_died"
    recap = game.get_recap("Recruit")
    assert recap["you_won"] is False
    assert "Dead" in (recap["lesson"] or "")


def test_enemy_health_bonus_on_enter():
    game = _tiny_game()
    game.configure_match(
        match_modifiers={
            "enemy_character_health_bonus": 1,
            "enemy_player_name": "Inquisitor",
        },
        twist_label="Fortitude",
        twist_description="Enemy +1 Health",
    )
    if game.active_player.name != "Inquisitor":
        game.start_turn()
        game.end_turn()
    game.start_turn()
    ai = game.active_player
    assert ai.name == "Inquisitor"
    ai.energy = 10
    before = len(ai.board)
    result = game.play_card(0)
    assert result.get("success"), result
    assert len(ai.board) == before + 1
    inst = ai.board[-1]
    assert inst.health_bonus >= 1
    assert game.get_state()["twist"]["label"] == "Fortitude"


def test_campaign_data_loads():
    from engine.campaign import get_node, list_campaign_summaries, load_chapter

    summaries = list_campaign_summaries()
    assert any(s["id"] == "illuminati" for s in summaries)
    chapter = load_chapter("illuminati")
    node = get_node(chapter, "city", "escape")
    assert node["type"] == "crisis"
    assert node["crisis"]["turns"] == 5
    alley = get_node(chapter, "city", "alley_contact")
    assert alley.get("ai_starting_life") == 10
    assert alley.get("shuffle") is False
    assert alley.get("steps")
    assert len(alley.get("player_deck") or []) == 30


def test_match_options_ai_starting_life():
    from server.session import create_session, get_session

    sid = create_session(
        "Recruit",
        "illuminati",
        "reptilians",
        "Street Broker",
        player_deck_id="campaign_illuminati_city_starter",
        match_options={"ai_starting_life": 10},
    )
    game = get_session(sid)
    ai = next(p for p in game.players if p.name == "Street Broker")
    assert ai.life == 10


def test_hq_board_loads_and_reverse_order():
    from engine.campaign import get_node, load_chapter

    chapter = load_chapter("illuminati")
    assert "hq" in chapter.get("boards", [])
    assert "hq" in (chapter.get("board_data") or {})
    board = chapter["board_data"]["hq"]
    assert board.get("reverse_order") == ["train_bounce", "train_discard", "train_silence"]
    breach = get_node(chapter, "hq", "hq_breach")
    assert breach.get("triggers_reverse") is True
    silence = get_node(chapter, "hq", "train_silence")
    assert silence.get("reverse", {}).get("twist", {}).get("id") == "templar_fortitude"
    boss = get_node(chapter, "hq", "grandmaster")
    assert boss.get("boss_requires_reverse_clear") is True
    assert boss.get("ai_starting_life") == 16


def test_twist_modifier_via_match_options():
    from server.session import create_session, get_session

    sid = create_session(
        "Recruit",
        "illuminati",
        "templars",
        "Gate Warden",
        player_deck_id="campaign_illuminati_city_starter",
        match_options={
            "ai_starting_life": 14,
            "twist_label": "Righteous Fortitude",
            "twist_description": "Enemy +1 Health",
            "match_modifiers": {
                "enemy_character_health_bonus": 1,
                "enemy_player_name": "Gate Warden",
            },
        },
    )
    game = get_session(sid)
    assert game.twist_label == "Righteous Fortitude"
    ai = next(p for p in game.players if p.name == "Gate Warden")
    assert ai.life == 14
