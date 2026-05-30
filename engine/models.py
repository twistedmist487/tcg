"""
Pydantic data models for Conspiracy TCG.

This module defines the core data structures for cards, factions, and game
configuration. All JSON data files are validated through these models on load.

Usage:
    from engine.models import Card, Faction, load_cards, load_factions

    cards = load_cards("data/cards.json")
    factions = load_factions("data/factions.json")
"""

from __future__ import annotations

import json
from enum import StrEnum
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CardType(StrEnum):
    CHARACTER = "Character"
    SPELL = "Spell"
    LOCATION = "Location"


class FactionName(StrEnum):
    ILLUMINATI = "illuminati"
    TEMPLARS = "templars"
    REPTILIANS = "reptilians"


class EnergyType(StrEnum):
    INFLUENCE = "Influence"
    FAITH = "Faith"
    PSIONICS = "Psionics"


# Each faction maps to exactly one energy type
FACTION_ENERGY: dict[FactionName, EnergyType] = {
    FactionName.ILLUMINATI: EnergyType.INFLUENCE,
    FactionName.TEMPLARS: EnergyType.FAITH,
    FactionName.REPTILIANS: EnergyType.PSIONICS,
}


# ---------------------------------------------------------------------------
# Card Models
# ---------------------------------------------------------------------------

class CardBase(BaseModel):
    """Shared fields for all card types."""

    id: str = Field(
        ...,
        description="Unique card identifier, e.g. 'illuminati_char_001'",
        pattern=r"^[a-z]+_(char|spell|loc)_\d{3}$",
    )
    name: str = Field(..., min_length=1, max_length=60)
    faction: FactionName
    energy_type: EnergyType
    cost: int = Field(..., ge=0, le=20)
    lore: str = Field(..., min_length=1, max_length=300)

    @model_validator(mode="after")
    def validate_energy_matches_faction(self) -> CardBase:
        expected = FACTION_ENERGY.get(self.faction)
        if expected and self.energy_type != expected:
            raise ValueError(
                f"faction '{self.faction.value}' requires energy_type "
                f"'{expected.value}', got '{self.energy_type.value}'"
            )
        return self


class CharacterCard(CardBase):
    """A character card -- deployed to the board, can attack and defend."""

    type: Literal[CardType.CHARACTER] = CardType.CHARACTER
    attack: int = Field(..., ge=0, le=20)
    health: int = Field(..., ge=1, le=20)
    ability: str = Field(..., min_length=1, max_length=300)


class SpellCard(CardBase):
    """A spell card -- one-time effect, resolved then discarded."""

    type: Literal[CardType.SPELL] = CardType.SPELL
    effect: str = Field(..., min_length=1, max_length=300)


class LocationCard(CardBase):
    """A location card -- persists on the board with an ongoing effect."""

    type: Literal[CardType.LOCATION] = CardType.LOCATION
    effect: str = Field(..., min_length=1, max_length=300)


# Discriminated union: Pydantic selects the right model based on `type`
Card = CharacterCard | SpellCard | LocationCard


# ---------------------------------------------------------------------------
# Faction Model
# ---------------------------------------------------------------------------

class Faction(BaseModel):
    """A playable faction."""

    name: str = Field(..., min_length=1)
    energy_type: EnergyType
    lore_summary: str = Field(..., min_length=1, max_length=200)
    key_mechanics: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def load_json(path: Path | str) -> list[dict] | dict:
    """Load raw JSON from a file path."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")
    with open(path) as f:
        return json.load(f)


def _resolve_card(raw: dict) -> Card:
    """Parse a raw dict into the correct card subtype."""
    ctype = raw.get("type", "")
    match ctype:
        case "Character":
            return CharacterCard(**raw)
        case "Spell":
            return SpellCard(**raw)
        case "Location":
            return LocationCard(**raw)
        case _:
            raise ValueError(f"Unknown card type: {ctype!r}")


def load_cards(path: Path | str) -> list[Card]:
    """
    Validate and load all cards from a JSON file.

    Raises ValueError with a descriptive message if any card fails validation.
    """
    raw = load_json(path)
    if not isinstance(raw, list):
        raise TypeError(f"Expected JSON array in {path}, got {type(raw).__name__}")

    cards: list[Card] = []
    errors: list[str] = []

    for i, entry in enumerate(raw):
        try:
            cards.append(_resolve_card(entry))
        except (ValueError, TypeError) as exc:
            name = entry.get("name", entry.get("id", f"#{i + 1}"))
            errors.append(f"Card '{name} (index {i})': {exc}")

    if errors:
        raise ValueError(
            f"Failed to validate {len(errors)} card(s):\n"
            + "\n".join(f"  - {e}" for e in errors)
        )

    return cards


def load_factions(path: Path | str) -> dict[str, Faction]:
    """Validate and load all factions from a JSON file."""
    raw = load_json(path)
    if not isinstance(raw, dict):
        raise TypeError(f"Expected JSON object in {path}, got {type(raw).__name__}")

    factions: dict[str, Faction] = {}
    errors: list[str] = []

    for key, entry in raw.items():
        try:
            factions[key] = Faction(**entry)
        except (ValueError, TypeError) as exc:
            name = entry.get("name", key)
            errors.append(f"Faction '{name} ({key})': {exc}")

    if errors:
        raise ValueError(
            f"Failed to validate {len(errors)} faction(s):\n"
            + "\n".join(f"  - {e}" for e in errors)
        )

    return factions
