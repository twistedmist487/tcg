"""Tests for the Pydantic data models and loaders."""

import json
from pathlib import Path

import pytest

from engine.models import (
    CardType,
    CharacterCard,
    EnergyType,
    Faction,
    FactionName,
    LocationCard,
    SpellCard,
    load_cards,
    load_factions,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def character_card_data() -> dict:
    return {
        "id": "illuminati_char_001",
        "name": "Shadow Broker",
        "type": "Character",
        "faction": "illuminati",
        "energy_type": "Influence",
        "cost": 3,
        "attack": 2,
        "health": 3,
        "ability": "When played, look at opponent's hand and discard one card.",
        "lore": "A master of secrets.",
    }


@pytest.fixture
def spell_card_data() -> dict:
    return {
        "id": "templars_spell_001",
        "name": "Divine Smite",
        "type": "Spell",
        "faction": "templars",
        "energy_type": "Faith",
        "cost": 3,
        "effect": "Deal 4 damage to a target character.",
        "lore": "The wrath of the heavens.",
    }


@pytest.fixture
def location_card_data() -> dict:
    return {
        "id": "reptilians_loc_001",
        "name": "Hidden Hive",
        "type": "Location",
        "faction": "reptilians",
        "energy_type": "Psionics",
        "cost": 4,
        "effect": "Your Reptilian characters gain 'When this character attacks, draw a card.'",
        "lore": "A nexus of alien activity.",
    }


@pytest.fixture
def cards_json(tmp_path: Path, character_card_data, spell_card_data, location_card_data) -> Path:
    """Write a minimal cards.json and return its path."""
    data = [character_card_data, spell_card_data, location_card_data]
    path = tmp_path / "cards.json"
    path.write_text(json.dumps(data, indent=2))
    return path


# ---------------------------------------------------------------------------
# Character Card
# ---------------------------------------------------------------------------

class TestCharacterCard:
    def test_create_valid(self, character_card_data):
        card = CharacterCard(**character_card_data)
        assert card.name == "Shadow Broker"
        assert card.type == CardType.CHARACTER
        assert card.faction == FactionName.ILLUMINATI
        assert card.cost == 3
        assert card.attack == 2
        assert card.health == 3

    def test_wrong_energy_for_faction(self, character_card_data):
        data = {**character_card_data, "energy_type": "Faith"}
        with pytest.raises(ValueError, match="requires energy_type"):
            CharacterCard(**data)

    def test_zero_health_invalid(self, character_card_data):
        data = {**character_card_data, "health": 0}
        with pytest.raises(ValueError):
            CharacterCard(**data)

    def test_negative_cost_invalid(self, character_card_data):
        data = {**character_card_data, "cost": -1}
        with pytest.raises(ValueError):
            CharacterCard(**data)

    def test_empty_name_invalid(self, character_card_data):
        data = {**character_card_data, "name": ""}
        with pytest.raises(ValueError):
            CharacterCard(**data)

    def test_bad_id_format(self, character_card_data):
        data = {**character_card_data, "id": "BAD-ID"}
        with pytest.raises(ValueError):
            CharacterCard(**data)


# ---------------------------------------------------------------------------
# Spell Card
# ---------------------------------------------------------------------------

class TestSpellCard:
    def test_create_valid(self, spell_card_data):
        card = SpellCard(**spell_card_data)
        assert card.name == "Divine Smite"
        assert card.type == CardType.SPELL
        assert card.cost == 3

    def test_wrong_energy(self, spell_card_data):
        data = {**spell_card_data, "energy_type": "Influence"}
        with pytest.raises(ValueError, match="requires energy_type"):
            SpellCard(**data)


# ---------------------------------------------------------------------------
# Location Card
# ---------------------------------------------------------------------------

class TestLocationCard:
    def test_create_valid(self, location_card_data):
        card = LocationCard(**location_card_data)
        assert card.name == "Hidden Hive"
        assert card.type == CardType.LOCATION


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

class TestLoadCards:
    def test_load_valid(self, cards_json):
        cards = load_cards(cards_json)
        assert len(cards) == 3
        assert isinstance(cards[0], CharacterCard)
        assert isinstance(cards[1], SpellCard)
        assert isinstance(cards[2], LocationCard)

    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            load_cards("nonexistent.json")

    def test_not_a_list(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text("{}")
        with pytest.raises(TypeError, match="Expected JSON array"):
            load_cards(path)

    def test_unknown_card_type(self, tmp_path):
        data = [{"id": "illuminati_char_001", "name": "Test", "type": "Trap",
                 "faction": "illuminati", "energy_type": "Influence", "cost": 1,
                 "lore": "test", "attack": 1, "health": 1, "ability": "test"}]
        path = tmp_path / "cards.json"
        path.write_text(json.dumps(data))
        with pytest.raises(ValueError, match="Unknown card type"):
            load_cards(path)

    def test_mixed_valid_and_invalid_reports_all(self, tmp_path):
        data = [
            {"type": "Character", "faction": "illuminati", "energy_type": "Faith",
             "cost": 1, "attack": 1, "health": 1, "ability": "x", "lore": "x"},
        ]
        # Missing id and name -- should get a clear error
        path = tmp_path / "cards.json"
        path.write_text(json.dumps(data))
        with pytest.raises(ValueError, match="Failed to validate"):
            load_cards(path)


# ---------------------------------------------------------------------------
# Faction Model
# ---------------------------------------------------------------------------

class TestFaction:
    def test_create_valid(self):
        f = Faction(
            name="The Illuminati",
            energy_type=EnergyType.INFLUENCE,
            lore_summary="Ancient secret society.",
            key_mechanics=["Control", "Stealth"],
        )
        assert f.name == "The Illuminati"
        assert f.energy_type == EnergyType.INFLUENCE
        assert len(f.key_mechanics) == 2

    def test_default_mechanics_empty(self):
        f = Faction(
            name="Test",
            energy_type=EnergyType.FAITH,
            lore_summary="Test lore.",
        )
        assert f.key_mechanics == []


# ---------------------------------------------------------------------------
# Load Factions
# ---------------------------------------------------------------------------

class TestLoadFactions:
    def test_load_valid(self, tmp_path):
        data = {
            "illuminati": {
                "name": "The Illuminati",
                "energy_type": "Influence",
                "lore_summary": "Secret society.",
                "key_mechanics": ["Control"],
            }
        }
        path = tmp_path / "factions.json"
        path.write_text(json.dumps(data))
        factions = load_factions(path)
        assert "illuminati" in factions
        assert factions["illuminati"].energy_type == EnergyType.INFLUENCE

    def test_not_an_object(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text("[]")
        with pytest.raises(TypeError, match="Expected JSON object"):
            load_factions(path)
