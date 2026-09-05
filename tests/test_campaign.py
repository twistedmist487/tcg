"""Tests for campaign crisis, twists, and run-deck mutation."""

from engine.campaign import (
    add_card,
    apply_safehouse_pick,
    campaign_coach,
    count_copies,
    get_node,
    list_campaign_summaries,
    load_chapter,
    player_deck_mode,
    reverse_queue,
    seed_teach_front,
    starter_deck_ids,
)
from engine.game import Game
from engine.models import load_cards


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
    assert alley.get("player_deck_mode") == "scripted"


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
    assert boss.get("player_deck_mode") == "run"
    assert silence.get("player_deck_mode") == "run_teach"


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


def test_starter_deck_is_thirty():
    ids = starter_deck_ids("campaign_illuminati_city_starter")
    assert len(ids) == 30
    assert count_copies(ids, "illuminati_char_009") == 2
    assert count_copies(ids, "illuminati_char_001") == 1
    assert "neutral_char_010" not in ids


def test_safe_drop_take_the_bag():
    deck = starter_deck_ids("campaign_illuminati_city_starter")
    pick = {
        "id": "neutral_char_010",
        "action": "add",
        "copies": 1,
        "trim": ["neutral_char_028", "neutral_spell_022", "neutral_char_001"],
        "label": "Take the bag",
    }
    before_trim = count_copies(deck, "neutral_char_028")
    out, flags = apply_safehouse_pick(deck, pick)
    assert len(out) == 30
    assert count_copies(out, "neutral_char_010") == 1
    assert count_copies(out, "neutral_char_028") == before_trim - 1
    assert flags["last_deck_change"] == "added:neutral_char_010"


def test_safe_drop_prune_lobbyist():
    deck = starter_deck_ids("campaign_illuminati_city_starter")
    pick = {"id": "illuminati_char_009", "action": "prune", "prune_id": "illuminati_char_009"}
    out, flags = apply_safehouse_pick(deck, pick)
    assert count_copies(out, "illuminati_char_009") == 1
    assert len(out) == 29
    assert "pruned" in flags["last_deck_change"]


def test_safe_drop_keep_walking():
    deck = starter_deck_ids("campaign_illuminati_city_starter")
    out, flags = apply_safehouse_pick(deck, {"id": "walk", "action": "skip"})
    assert out == deck
    assert flags["skipped_safe_drop"] is True


def test_vestry_and_molt_skip_set_distinct_flags():
    deck = starter_deck_ids("campaign_illuminati_city_starter")
    _, vestry = apply_safehouse_pick(deck, {"id": "walk", "action": "skip"}, "vestry")
    assert vestry["skipped_vestry"] is True
    assert "skipped_safe_drop" not in vestry
    _, molt = apply_safehouse_pick(deck, {"id": "walk", "action": "skip"}, "molt")
    assert molt["skipped_molt"] is True
    assert "skipped_vestry" not in molt
    assert "skipped_safe_drop" not in molt

def test_armory_inject_and_puppet_skip():
    deck = starter_deck_ids("campaign_illuminati_city_starter")
    pick = {
        "id": "illuminati_char_005",
        "action": "inject",
        "copies": 1,
        "skip_reverse_node": "train_bounce",
        "label": "Puppet Master",
        "trim": ["neutral_char_028"],
    }
    out, flags = apply_safehouse_pick(deck, pick)
    assert count_copies(out, "illuminati_char_005") == 1
    assert len(out) == 30
    assert flags["skip_reverse_node"] == "train_bounce"
    assert flags["last_armory_pick"] == "Puppet Master"
    board = load_chapter("illuminati")["board_data"]["hq"]
    q = reverse_queue(board, flags)
    assert "train_bounce" not in q
    assert q == ["train_discard", "train_silence"]


def test_seed_teach_loans_missing_card():
    deck = ["illuminati_char_009"] * 2 + ["neutral_char_001"] * 28
    seeded = seed_teach_front(deck, ["illuminati_spell_001"])
    assert seeded[0] == "illuminati_spell_001"
    assert len(seeded) == 31


def test_coach_swaps_after_recruiter_dies():
    assert campaign_coach({}, "city") == "recruiter"
    assert campaign_coach({"recruiter_dead": True}, "city") == "ops"
    assert campaign_coach({}, "hq") == "ops"


def test_city_safe_drop_and_initiation_modes():
    chapter = load_chapter("illuminati")
    drop = get_node(chapter, "city", "safe_drop")
    picks = (drop.get("safehouse") or {}).get("pick_one_of") or []
    assert len(picks) == 3
    assert {p["action"] for p in picks} == {"add", "prune", "skip"}
    initiation = get_node(chapter, "city", "initiation")
    assert player_deck_mode(initiation) == "run_teach"
    escape = get_node(chapter, "city", "escape")
    assert player_deck_mode(escape) == "run"
    assert escape.get("coach") == "silent"


def test_add_respects_copy_cap():
    deck = starter_deck_ids("campaign_illuminati_city_starter")
    # starter already has 2 Burn Notice
    out = add_card(deck, "neutral_spell_003", copies=1)
    assert count_copies(out, "neutral_spell_003") == 2
    assert len(out) == 30
