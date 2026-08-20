"""Phase 9 Slice A+B: Keyword Lab, Deathrattle tutorial, Medium AI scoring."""

from engine.ai import AIPlayer, score_action
from engine.card import create_card_instance
from engine.decks import load_encounters
from engine.models import CharacterCard, load_cards
from engine.game import Game


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


def _game():
    cards = load_cards("data/cards.json")
    deck = [c for c in cards if c.faction.value == "illuminati"][:10] * 2
    return Game.setup(deck, list(deck), "Human", "AI")


def test_keyword_lab_encounter():
    lab = load_encounters()["keyword_lab"]
    assert lab["mode"] == "lab"
    assert len(lab["player_deck"]) == 30
    ids = {s["id"] for s in lab["steps"]}
    assert {"recycle", "split", "drain", "ward"} <= ids


def test_tutorial_has_deathrattle_step():
    steps = load_encounters()["tutorial"]["steps"]
    assert any(s["id"] == "deathrattle" for s in steps)


def test_easy_recruiter_pokes_face():
    easy = AIPlayer(difficulty="easy")
    assert easy.skip_attack_chance == 0.0
    assert easy.poke_face == 1.0


def test_stealth_board_face_is_legal():
    game = _game()
    game.start_turn()
    player, opponent = game.active_player, game.inactive_player
    player.board.clear()
    opponent.board.clear()
    atk = create_card_instance(_char("Poke", attack=2, health=2), "a", player.name)
    atk.is_exhausted = False
    ghost = create_card_instance(_char("Ghost", attack=1, health=1, ability="Stealth"), "g", opponent.name)
    ghost.is_stealth = True
    player.board.append(atk)
    opponent.board.append(ghost)
    assert score_action(game, {"action": "attack", "attacker_index": 0, "target_index": None}) > 0
