"""Tests for the card validator."""


from tools.validate_cards import validate_cards


class TestValidateCards:
    def _card(self, **overrides) -> dict:
        """Build a minimal valid card with optional overrides."""
        base = {
            "id": "illuminati_char_001",
            "name": "Test Card",
            "type": "Character",
            "faction": "illuminati",
            "cost": 3,
            "energy_type": "Influence",
            "attack": 2,
            "health": 3,
            "ability": "Test ability.",
            "lore": "Test lore.",
        }
        base.update(overrides)
        return base

    def test_valid_character(self):
        errors = validate_cards([self._card()])
        assert errors == []

    def test_valid_spell(self):
        card = self._card(
            id="illuminati_spell_001",
            type="Spell",
            energy_type="Influence",
            attack=None,
            health=None,
            ability=None,
            effect="Deal 3 damage.",
        )
        # Remove fields not applicable to spells
        del card["attack"]
        del card["health"]
        del card["ability"]
        errors = validate_cards([card])
        assert errors == []

    def test_valid_location(self):
        card = self._card(
            id="illuminati_loc_001",
            type="Location",
            effect="Your characters gain +1 Attack.",
        )
        del card["attack"]
        del card["health"]
        del card["ability"]
        errors = validate_cards([card])
        assert errors == []

    def test_missing_required_field(self):
        card = self._card()
        del card["name"]
        errors = validate_cards([card])
        assert any("missing required field 'name'" in e for e in errors)

    def test_invalid_type(self):
        card = self._card(type="Trap")
        errors = validate_cards([card])
        assert any("invalid type" in e for e in errors)

    def test_invalid_faction(self):
        card = self._card(faction="illuminati_x")
        errors = validate_cards([card])
        assert any("invalid faction" in e for e in errors)

    def test_wrong_energy_for_faction(self):
        card = self._card(energy_type="Faith")
        errors = validate_cards([card])
        assert any("expects energy" in e for e in errors)

    def test_negative_cost(self):
        card = self._card(cost=-1)
        errors = validate_cards([card])
        assert any("cost must be a non-negative" in e for e in errors)

    def test_duplicate_id(self):
        cards = [self._card(), self._card()]
        errors = validate_cards(cards)
        assert any("duplicate id" in e for e in errors)

    def test_missing_character_fields(self):
        card = self._card()
        del card["attack"]
        errors = validate_cards([card])
        assert any("Character missing 'attack'" in e for e in errors)

    def test_health_must_be_positive(self):
        card = self._card(health=0)
        errors = validate_cards([card])
        assert any("health must be positive" in e for e in errors)
