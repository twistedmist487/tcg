"""Deck construction and validation for Conspiracy TCG."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from engine.card import is_token_card
from engine.models import Card, load_cards

MAX_DECK_SIZE = 30
MAX_COPIES = 2
MAX_NEUTRALS = 12
FACTION_KEYS = ("illuminati", "templars", "reptilians")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_card_lookup(cards_path: str | Path | None = None) -> dict[str, Card]:
    """Load cards.json into an id -> Card map."""
    path = Path(cards_path) if cards_path else DATA_DIR / "cards.json"
    return {card.id: card for card in load_cards(path)}


def load_curated_decks(decks_path: str | Path | None = None) -> dict[str, Any]:
    """Load curated faction decks from data/decks.json."""
    path = Path(decks_path) if decks_path else DATA_DIR / "decks.json"
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def load_encounters(encounters_path: str | Path | None = None) -> dict[str, Any]:
    """Load tutorial and showcase encounters from data/encounters.json."""
    path = Path(encounters_path) if encounters_path else DATA_DIR / "encounters.json"
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def expand_deck_entries(entries: list[dict[str, Any]]) -> list[str]:
    """Expand [{id, copies}] (or a flat id list) into a list of card IDs."""
    if not entries:
        return []
    if isinstance(entries[0], str):
        return list(entries)
    ids: list[str] = []
    for entry in entries:
        card_id = entry["id"]
        copies = int(entry.get("copies", 1))
        ids.extend([card_id] * copies)
    return ids


def validate_deck(
    entries: list[dict[str, Any]] | list[str],
    cards_by_id: dict[str, Card] | None = None,
    *,
    faction: str | None = None,
    require_size: bool = True,
    require_faction: bool = True,
) -> dict[str, Any]:
    """
    Validate a deck list.

    Returns:
        {valid, errors, size, faction_counts}
    """
    cards_by_id = cards_by_id or load_card_lookup()
    card_ids = expand_deck_entries(entries)
    errors: list[str] = []
    counts: dict[str, int] = {}
    faction_counts: dict[str, int] = {}

    for card_id in card_ids:
        if card_id not in cards_by_id:
            errors.append(f"Unknown card id: {card_id}")
            continue
        counts[card_id] = counts.get(card_id, 0) + 1
        card = cards_by_id[card_id]
        if is_token_card(card):
            errors.append(f"{card_id} is a token and cannot go in a deck")
        card_faction = card.faction.value
        faction_counts[card_faction] = faction_counts.get(card_faction, 0) + 1

    for card_id, copies in counts.items():
        if copies > MAX_COPIES:
            errors.append(f"{card_id} has {copies} copies (max {MAX_COPIES})")

    if require_size and len(card_ids) != MAX_DECK_SIZE:
        errors.append(f"Deck has {len(card_ids)} cards (expected {MAX_DECK_SIZE})")

    if require_faction and faction:
        off_faction = [fid for fid in faction_counts if fid not in (faction, "neutral")]
        if off_faction:
            errors.append(f"Deck contains off-faction cards: {', '.join(sorted(off_faction))}")
        neutrals = faction_counts.get("neutral", 0)
        if neutrals > MAX_NEUTRALS:
            errors.append(
                f"Deck has {neutrals} Network cards (max {MAX_NEUTRALS})"
            )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "size": len(card_ids),
        "faction_counts": faction_counts,
        "card_ids": card_ids,
    }


def build_deck(
    entries: list[dict[str, Any]] | list[str],
    cards_by_id: dict[str, Card] | None = None,
) -> list[Card]:
    """Build a list of Card objects from deck entries. Raises ValueError if invalid IDs."""
    cards_by_id = cards_by_id or load_card_lookup()
    deck: list[Card] = []
    for card_id in expand_deck_entries(entries):
        if card_id not in cards_by_id:
            raise ValueError(f"Unknown card id: {card_id}")
        deck.append(cards_by_id[card_id])
    return deck


def load_presets(decks_path: str | Path | None = None) -> list[dict[str, Any]]:
    """Named test / showcase lists from decks.json ``presets``."""
    data = load_curated_decks(decks_path)
    raw = data.get("presets") or []
    return [entry for entry in raw if isinstance(entry, dict) and entry.get("id")]


def build_named_deck(
    deck_id: str,
    cards_by_id: dict[str, Card] | None = None,
) -> list[Card]:
    """Load a faction default or a preset by id."""
    if deck_id in FACTION_KEYS:
        return build_faction_deck(deck_id, cards_by_id)
    for preset in load_presets():
        if preset.get("id") == deck_id:
            return build_deck(preset["cards"], cards_by_id)
    raise ValueError(f"Unknown deck: {deck_id}")


def build_faction_deck(faction: str, cards_by_id: dict[str, Card] | None = None) -> list[Card]:
    """Build a 30-card deck from the curated list, falling back to the faction pool."""
    cards_by_id = cards_by_id or load_card_lookup()
    try:
        curated = load_curated_decks()
        if faction in curated:
            return build_deck(curated[faction]["cards"], cards_by_id)
    except (FileNotFoundError, KeyError, ValueError):
        pass

    pool = [card for card in cards_by_id.values() if card.faction.value == faction]
    deck: list[Card] = []
    idx = 0
    while len(deck) < MAX_DECK_SIZE and pool:
        card = pool[idx % len(pool)]
        copies = sum(1 for item in deck if item.id == card.id)
        if copies < MAX_COPIES:
            deck.append(card)
        idx += 1
        if idx > len(pool) * MAX_COPIES + 10:
            break
    return deck
