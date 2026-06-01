"""Tests for curated deck loading and deck building."""

import json
from pathlib import Path

from engine.models import load_cards
from server.session import _load_deck, create_session, get_session

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_decks_json():
    with open(DATA_DIR / "decks.json") as f:
        return json.load(f)


class TestDecksJson:
    """Validate the curated decks.json file."""

    def test_all_factions_present(self):
        decks = _load_decks_json()
        assert "illuminati" in decks
        assert "templars" in decks
        assert "reptilians" in decks

    def test_each_deck_has_30_cards(self):
        decks = _load_decks_json()
        for faction, deck in decks.items():
            total = sum(c["copies"] for c in deck["cards"])
            assert total == 30, f"{faction} deck has {total} cards, expected 30"

    def test_no_card_exceeds_3_copies(self):
        decks = _load_decks_json()
        for faction, deck in decks.items():
            for entry in deck["cards"]:
                assert entry["copies"] <= 3, (
                    f"{faction}: {entry['id']} has {entry['copies']} copies"
                )

    def test_all_card_ids_exist(self):
        cards = {c.id for c in load_cards(DATA_DIR / "cards.json")}
        decks = _load_decks_json()
        for faction, deck in decks.items():
            for entry in deck["cards"]:
                assert entry["id"] in cards, (
                    f"{faction}: card {entry['id']} not found in cards.json"
                )

    def test_only_faction_cards_in_deck(self):
        all_cards = {c.id: c for c in load_cards(DATA_DIR / "cards.json")}
        decks = _load_decks_json()
        for faction, deck in decks.items():
            for entry in deck["cards"]:
                card = all_cards[entry["id"]]
                assert card.faction.value == faction, (
                    f"{faction} deck contains {entry['id']} (faction: {card.faction.value})"
                )


class TestLoadDeck:
    """Test the _load_deck function."""

    def test_illuminati_deck_loads(self):
        deck = _load_deck("illuminati")
        assert len(deck) == 30

    def test_templars_deck_loads(self):
        deck = _load_deck("templars")
        assert len(deck) == 30

    def test_reptilians_deck_loads(self):
        deck = _load_deck("reptilians")
        assert len(deck) == 30

    def test_deck_has_max_3_copies_per_card(self):
        for faction in ["illuminati", "templars", "reptilians"]:
            deck = _load_deck(faction)
            from collections import Counter

            counts = Counter(c.id for c in deck)
            max_count = max(counts.values())
            assert max_count <= 3, f"{faction} deck has a card with {max_count} copies"

    def test_deck_contains_characters(self):
        for faction in ["illuminati", "templars", "reptilians"]:
            deck = _load_deck(faction)
            chars = [c for c in deck if c.type.value == "Character"]
            assert len(chars) > 0, f"{faction} deck has no characters"

    def test_deck_contains_spells(self):
        for faction in ["illuminati", "templars", "reptilians"]:
            deck = _load_deck(faction)
            spells = [c for c in deck if c.type.value == "Spell"]
            assert len(spells) > 0, f"{faction} deck has no spells"


class TestCreateSessionWithDecks:
    """Test that sessions use the curated 30-card decks."""

    def test_create_illuminati_vs_templars(self):
        sid = create_session("Test", "illuminati", "templars")
        game = get_session(sid)
        assert game is not None
        # Both players should have 30-card decks
        for p in game.players:
            assert p.deck_size + p.hand_size == 30

    def test_create_reptilians_vs_illuminati(self):
        sid = create_session("Test", "reptilians", "illuminati")
        game = get_session(sid)
        assert game is not None
        for p in game.players:
            assert p.deck_size + p.hand_size == 30

    def test_create_all_faction_matchups(self):
        factions = ["illuminati", "templars", "reptilians"]
        for f1 in factions:
            for f2 in factions:
                if f1 != f2:
                    sid = create_session("Test", f1, f2)
                    game = get_session(sid)
                    assert game is not None
                    for p in game.players:
                        assert p.deck_size + p.hand_size == 30

    def test_starting_hand_is_4(self):
        sid = create_session("Test", "illuminati", "templars")
        game = get_session(sid)
        for p in game.players:
            assert p.hand_size == 4

    def test_decks_are_single_faction(self):
        sid = create_session("Test", "illuminati", "reptilians")
        game = get_session(sid)
        # Player 1 should be Illuminati
        p1_cards = [c for p in game.players if p.name == "Test" for c in p.hand]
        for c in p1_cards:
            assert c.faction.value == "illuminati"
