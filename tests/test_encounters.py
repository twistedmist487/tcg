"""Tests for encounters, deck validation, AI difficulty, and recap."""

from engine.ai import AIPlayer, choose_action, execute_turn
from engine.decks import (
    build_deck,
    load_encounters,
    validate_deck,
)
from engine.game import Game
from engine.models import CharacterCard, load_cards
from server.session import create_session, get_session, get_session_info


def _fill_deck(card: CharacterCard) -> list:
    return [card] * 30


def _char(name="Pawn", cost=1, attack=1, health=2, ability="None"):
    return CharacterCard(
        id="illuminati_char_001",
        name=name,
        faction="illuminati",
        energy_type="Influence",
        cost=cost,
        lore="test",
        attack=attack,
        health=health,
        ability=ability,
    )


class TestEncounterData:
    def test_tutorial_and_showcases_exist(self):
        encounters = load_encounters()
        assert "tutorial" in encounters
        assert "keyword_lab" in encounters
        assert "showcase_illuminati" in encounters
        assert "showcase_templars" in encounters
        assert "showcase_reptilians" in encounters
        assert "challenge_black_room" in encounters
        assert "challenge_street_war" in encounters
        assert "challenge_unquiet" in encounters

    def test_tutorial_decks_are_30(self):
        tutorial = load_encounters()["tutorial"]
        assert len(tutorial["player_deck"]) == 30
        assert len(tutorial["ai_deck"]) == 30

    def test_tutorial_decks_exist_in_cards(self):
        cards = {c.id for c in load_cards("data/cards.json")}
        tutorial = load_encounters()["tutorial"]
        for card_id in tutorial["player_deck"] + tutorial["ai_deck"]:
            assert card_id in cards

    def test_tutorial_has_teaching_steps(self):
        steps = load_encounters()["tutorial"]["steps"]
        ids = {s["id"] for s in steps}
        assert {
            "welcome",
            "exhaustion",
            "attack",
            "deathrattle",
            "taunt",
            "spell",
            "location",
            "charge",
            "free",
        } <= ids

    def test_keyword_lab_has_teaching_steps(self):
        lab = load_encounters()["keyword_lab"]
        assert lab["mode"] == "lab"
        assert len(lab["player_deck"]) == 30
        assert len(lab["ai_deck"]) == 30
        ids = {s["id"] for s in lab["steps"]}
        assert {"recycle", "split", "drain", "drain-attack", "ward", "free"} <= ids
        assert lab["player_deck"][0] == "neutral_spell_007"
        assert lab["player_deck"][1] == "neutral_spell_008"
        assert lab["player_deck"][2] == "neutral_char_013"
        assert lab["ai_deck"][0] == "reptilians_char_007"

    def test_keyword_lab_cards_exist(self):
        cards = {c.id for c in load_cards("data/cards.json")}
        lab = load_encounters()["keyword_lab"]
        for card_id in lab["player_deck"] + lab["ai_deck"]:
            assert card_id in cards

    def test_recruiter_deck_is_reptilian_or_network(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        tutorial = load_encounters()["tutorial"]
        for card_id in tutorial["ai_deck"]:
            assert cards[card_id].faction.value in ("reptilians", "neutral"), card_id
        assert "templars_char_002" not in tutorial["ai_deck"]
        assert "neutral_char_007" in tutorial["ai_deck"]
        assert tutorial["ai_deck"][0] == "reptilians_char_007"


class TestChallengeEncounters:
    def test_challenges_are_hard_and_thirty(self):
        encounters = load_encounters()
        cards = {c.id: c for c in load_cards("data/cards.json")}
        for key in ("challenge_black_room", "challenge_street_war", "challenge_unquiet"):
            enc = encounters[key]
            assert enc["mode"] == "challenge"
            assert enc["difficulty"] == "hard"
            assert len(enc["ai_deck"]) == 30
            assert all(card_id in cards for card_id in enc["ai_deck"])
            checked = validate_deck(enc["ai_deck"], cards, faction=enc["ai_faction"])
            assert checked["valid"], checked["errors"]

        def blob(enc_id: str) -> str:
            return " ".join(
                f"{getattr(cards[i], 'ability', '')} {getattr(cards[i], 'effect', '')}"
                for i in encounters[enc_id]["ai_deck"]
            )

        black = blob("challenge_black_room").lower()
        assert "silence" in black and "discard" in black
        street = blob("challenge_street_war")
        assert "Rush" in street and "Charge" in street
        unquiet = blob("challenge_unquiet")
        assert "Recur" in unquiet
        assert "Deathrattle" in unquiet or "When this character dies" in unquiet

    def test_challenge_session_uses_hard(self):
        sid = create_session("P", "templars", "illuminati", encounter_id="challenge_black_room")
        info = get_session_info(sid)
        assert info is not None
        assert info.difficulty == "hard"
        assert info.mode == "challenge"
        assert info.ai_name == "The Censor"


class TestChargeKeyword:
    def test_zealot_can_attack_the_turn_it_is_played(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        zealot = cards["templars_char_012"]
        pawn = cards["templars_char_009"]
        game = Game.setup(
            [zealot] + [pawn] * 29,
            [pawn] * 30,
            "A",
            "B",
            first_player=0,
            shuffle=False,
        )
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, card in enumerate(game.active_player.hand) if card.id == "templars_char_012")
        played = game.play_card(idx)
        assert played["success"] is True
        charger = game.active_player.board[-1]
        assert charger.has_charge is True
        assert charger.is_exhausted is False
        before = game.inactive_player.life
        struck = game.attack(len(game.active_player.board) - 1, None)
        assert struck["success"] is True
        assert game.inactive_player.life == before - charger.current_attack


class TestDeckValidation:
    def test_valid_curated_shape(self):
        result = validate_deck(
            [{"id": "templars_char_009", "copies": 3}, {"id": "templars_char_006", "copies": 27}],
            require_size=False,
            faction="templars",
        )
        assert result["valid"] is False  # 27 copies exceeds max 2

    def test_rejects_unknown_id(self):
        result = validate_deck(
            [{"id": "nope_char_001", "copies": 30}],
            require_size=True,
            require_faction=False,
        )
        assert result["valid"] is False
        assert any("Unknown" in err for err in result["errors"])

    def test_allows_network_cards(self):
        result = validate_deck(
            [
                {"id": "templars_char_009", "copies": 2},
                {"id": "templars_char_006", "copies": 2},
                {"id": "templars_char_002", "copies": 2},
                {"id": "templars_char_001", "copies": 2},
                {"id": "templars_char_004", "copies": 2},
                {"id": "templars_char_007", "copies": 2},
                {"id": "templars_spell_001", "copies": 2},
                {"id": "templars_loc_001", "copies": 2},
                {"id": "templars_char_005", "copies": 2},
                {"id": "templars_char_012", "copies": 2},
                {"id": "templars_spell_003", "copies": 2},
                {"id": "neutral_char_001", "copies": 2},
                {"id": "neutral_char_002", "copies": 2},
                {"id": "neutral_spell_001", "copies": 2},
                {"id": "neutral_char_007", "copies": 2},
            ],
            faction="templars",
        )
        assert result["valid"] is True
        assert result["faction_counts"].get("neutral") == 8

    def test_rejects_too_many_network_cards(self):
        result = validate_deck(
            [
                {"id": "templars_char_009", "copies": 2},
                {"id": "templars_char_006", "copies": 2},
                {"id": "templars_char_002", "copies": 2},
                {"id": "templars_char_001", "copies": 2},
                {"id": "templars_char_004", "copies": 2},
                {"id": "templars_char_007", "copies": 2},
                {"id": "templars_spell_001", "copies": 2},
                {"id": "templars_loc_001", "copies": 2},
                {"id": "templars_char_005", "copies": 2},
                {"id": "templars_char_012", "copies": 2},
                {"id": "neutral_char_001", "copies": 2},
                {"id": "neutral_char_002", "copies": 2},
                {"id": "neutral_char_003", "copies": 2},
                {"id": "neutral_char_007", "copies": 2},
                {"id": "neutral_spell_001", "copies": 2},
                {"id": "neutral_char_009", "copies": 2},
                {"id": "neutral_char_010", "copies": 1},
            ],
            faction="templars",
        )
        assert result["valid"] is False
        assert any("Network" in err for err in result["errors"])

    def test_still_rejects_other_factions(self):
        result = validate_deck(
            [{"id": "templars_char_009", "copies": 27}, {"id": "illuminati_char_001", "copies": 3}],
            faction="templars",
        )
        assert result["valid"] is False
        assert any("off-faction" in err for err in result["errors"])

    def test_build_tutorial_deck(self):
        tutorial = load_encounters()["tutorial"]
        deck = build_deck(tutorial["player_deck"])
        assert len(deck) == 30
        assert deck[0].name == "Squire"


class TestTutorialSession:
    def test_create_tutorial_session(self):
        sid = create_session("Recruit", "templars", "reptilians", encounter_id="tutorial")
        info = get_session_info(sid)
        assert info is not None
        assert info.mode == "tutorial"
        assert info.difficulty == "easy"
        game = info.game
        recruit = next(p for p in game.players if p.name == "Recruit")
        recruiter = next(p for p in game.players if p.name == "The Recruiter")
        assert recruit.hand[0].name == "Squire"
        assert game.active_player.name == "Recruit"
        assert recruiter.life == 12

    def test_create_keyword_lab_session(self):
        sid = create_session("Operator", "templars", "reptilians", encounter_id="keyword_lab")
        info = get_session_info(sid)
        assert info is not None
        assert info.mode == "lab"
        assert info.difficulty == "easy"
        game = info.game
        operator = next(p for p in game.players if p.name == "Operator")
        assert operator.hand[0].name == "Burn Bag"
        assert operator.hand[1].name == "Forked Brief"
        assert operator.hand[2].name == "Leech Contact"
        assert game.active_player.name == "Operator"

    def test_location_state_includes_effect(self):
        sid = create_session("Recruit", "templars", "reptilians", encounter_id="tutorial")
        game = get_session(sid)
        chapel = next(c for c in load_cards("data/cards.json") if c.id == "templars_loc_001")
        recruit = next(p for p in game.players if p.name == "Recruit")
        from engine.card import create_card_instance

        recruit.location = create_card_instance(chapel, "loc1", "Recruit")
        loc = game.get_state()["players"][0]["location"]
        if game.get_state()["players"][0]["name"] != "Recruit":
            loc = next(p["location"] for p in game.get_state()["players"] if p["name"] == "Recruit")
        assert loc["name"] == "Sacred Chapel"
        assert "heal" in loc["effect"].lower()
        assert loc["type"] == "Location"

    def test_create_showcase_session(self):
        sid = create_session("Player", "illuminati", "templars", encounter_id="showcase_illuminati")
        info = get_session_info(sid)
        assert info is not None
        assert info.mode == "showcase"
        assert info.player_faction == "illuminati"
        game = get_session(sid)
        assert game is not None
        for player in game.players:
            assert player.deck_size + player.hand_size == 30


class TestTauntEnforced:
    def test_cannot_attack_face_through_taunt(self):
        taunt = CharacterCard(
            id="templars_char_002",
            name="Templar Guardian",
            faction="templars",
            energy_type="Faith",
            cost=2,
            lore="t",
            attack=1,
            health=4,
            ability="Taunt",
        )
        pawn = _char()
        game = Game.setup(_fill_deck(pawn), _fill_deck(taunt), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        # Put a ready attacker on A's board and a taunt on B's
        from engine.card import create_card_instance

        attacker = create_card_instance(pawn, "a1", "A")
        attacker.is_exhausted = False
        game.players[0].board = [attacker]
        blocker = create_card_instance(taunt, "b1", "B")
        game.players[1].board = [blocker]

        result = game.attack(0, None)
        assert result["success"] is False
        assert "Taunt" in result["error"]

    def test_can_attack_the_taunt(self):
        taunt = CharacterCard(
            id="templars_char_002",
            name="Templar Guardian",
            faction="templars",
            energy_type="Faith",
            cost=2,
            lore="t",
            attack=1,
            health=4,
            ability="Taunt",
        )
        pawn = _char(attack=2)
        game = Game.setup(_fill_deck(pawn), _fill_deck(taunt), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        from engine.card import create_card_instance

        attacker = create_card_instance(pawn, "a1", "A")
        attacker.is_exhausted = False
        game.players[0].board = [attacker]
        blocker = create_card_instance(taunt, "b1", "B")
        game.players[1].board = [blocker]

        result = game.attack(0, 0)
        assert result["success"] is True

    def test_can_attack_face_through_stealth_only(self):
        sneak = _char(name="Ghost", ability="Stealth")
        pawn = _char(attack=2)
        game = Game.setup(_fill_deck(pawn), _fill_deck(sneak), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        from engine.card import create_card_instance

        attacker = create_card_instance(pawn, "a1", "A")
        attacker.is_exhausted = False
        game.players[0].board = [attacker]
        ghost = create_card_instance(sneak, "b1", "B")
        game.players[1].board = [ghost]
        before = game.players[1].life
        result = game.attack(0, None)
        assert result["success"] is True
        assert game.players[1].life == before - 2


class TestRecap:
    def test_recap_counts_plays(self):
        squire = next(c for c in load_cards("data/cards.json") if c.id == "templars_char_009")
        deck = [squire] * 30
        game = Game.setup(deck, deck, "Hero", "Villain", first_player=0, shuffle=False)
        game.start_turn()
        played = game.play_card(0)
        assert played.get("success") is True
        recap = game.get_recap("Hero")
        assert recap["cards_played_count"] >= 1
        assert "Squire" in recap["cards_played"]
        assert recap["you_won"] is False
        assert recap["winner"] is None


class TestEasyAI:
    def test_easy_has_lower_aggression(self):
        easy = AIPlayer(faction="reptilians", difficulty="easy")
        medium = AIPlayer(faction="reptilians", difficulty="medium")
        assert easy.aggression < medium.aggression
        assert easy.mistake_chance > 0
        assert easy.skip_attack_chance == 0.0

    def test_easy_still_returns_valid_action(self):
        sid = create_session("P", "templars", "reptilians", encounter_id="tutorial")
        game = get_session(sid)
        assert game is not None
        game.start_turn()
        ai = AIPlayer(name="The Recruiter", faction="reptilians", difficulty="easy")
        action = choose_action(game, ai)
        assert action["action"] in ("play", "attack", "end_turn")

    def test_easy_can_finish_a_turn(self):
        sid = create_session("P", "templars", "reptilians", encounter_id="tutorial")
        game = get_session(sid)
        assert game is not None
        game.start_turn()
        if game.active_player.name == "P":
            game.end_turn()
            game.start_turn()
        ai = AIPlayer(name=game.active_player.name, faction="reptilians", difficulty="easy")
        execute_turn(game, ai)
        assert game.turn_started is False or game.is_over
