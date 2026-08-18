"""
Card schema validator for Conspiracy TCG.

Validates all cards in data/cards.json against the expected schema.
Run with: make validate  (or: python -m tools.validate_cards)
"""

import json
import sys
from pathlib import Path

REQUIRED_FIELDS = ["id", "name", "type", "faction", "cost", "energy_type", "lore"]
CHARACTER_FIELDS = ["attack", "health", "ability"]
SPELL_FIELDS = ["effect"]
LOCATION_FIELDS = ["effect"]

VALID_TYPES = {"Character", "Spell", "Location"}
VALID_FACTIONS = {"illuminati", "templars", "reptilians", "neutral"}
VALID_ENERGY = {"Influence", "Faith", "Psionics", "Conspiracy"}

FACTION_ENERGY_MAP = {
    "illuminati": "Influence",
    "templars": "Faith",
    "reptilians": "Psionics",
    "neutral": "Conspiracy",
}


def validate_cards(cards: list[dict]) -> list[str]:
    """Validate a list of card dicts. Returns list of error messages."""
    errors: list[str] = []
    ids_seen: set[str] = set()

    for i, card in enumerate(cards):
        prefix = f"Card #{i + 1} ({card.get('name', 'UNKNOWN')})"

        # Required fields
        for field in REQUIRED_FIELDS:
            if field not in card:
                errors.append(f"{prefix}: missing required field '{field}'")

        # Duplicate ID
        card_id = card.get("id", "")
        if card_id in ids_seen:
            errors.append(f"{prefix}: duplicate id '{card_id}'")
        ids_seen.add(card_id)

        # Type validation
        ctype = card.get("type", "")
        if ctype not in VALID_TYPES:
            errors.append(f"{prefix}: invalid type '{ctype}'")

        # Faction validation
        faction = card.get("faction", "")
        if faction not in VALID_FACTIONS:
            errors.append(f"{prefix}: invalid faction '{faction}'")

        # Energy type validation
        faction = card.get("faction", "")
        energy = card.get("energy_type", "")
        if energy not in VALID_ENERGY:
            errors.append(f"{prefix}: invalid energy_type '{energy}'")
        elif faction in FACTION_ENERGY_MAP and energy != FACTION_ENERGY_MAP[faction]:
            errors.append(
                f"{prefix}: faction '{faction}' expects energy '{FACTION_ENERGY_MAP[faction]}', got '{energy}'"
            )

        # Cost validation
        cost = card.get("cost", None)
        if cost is not None:
            if not isinstance(cost, int) or cost < 0:
                errors.append(f"{prefix}: cost must be a non-negative integer, got {cost}")

        # Type-specific fields
        if ctype == "Character":
            for field in CHARACTER_FIELDS:
                if field not in card:
                    errors.append(f"{prefix}: Character missing '{field}'")
            if "attack" in card and (not isinstance(card["attack"], int) or card["attack"] < 0):
                errors.append(f"{prefix}: attack must be non-negative int")
            if "health" in card and (not isinstance(card["health"], int) or card["health"] < 1):
                errors.append(f"{prefix}: health must be positive int")
        elif ctype == "Spell":
            for field in SPELL_FIELDS:
                if field not in card:
                    errors.append(f"{prefix}: Spell missing '{field}'")
        elif ctype == "Location":
            for field in LOCATION_FIELDS:
                if field not in card:
                    errors.append(f"{prefix}: Location missing '{field}'")

        errors.extend(_network_balance_errors(card, prefix))

    return errors


_GRANDFATHERED_NETWORK = {
    f"neutral_char_{n:03d}" for n in range(1, 21)
} | {
    f"neutral_spell_{n:03d}" for n in range(1, 12)
} | {
    f"neutral_loc_{n:03d}" for n in range(1, 4)
}


def _network_balance_errors(card: dict, prefix: str) -> list[str]:
    """New Network cards should sit 15–20% under the faction baseline."""
    if card.get("faction") != "neutral":
        return []
    if card.get("id") in _GRANDFATHERED_NETWORK:
        return []
    if (card.get("ability") or "").startswith("Token"):
        return []
    if card.get("balance") == "exception":
        return []
    errors: list[str] = []
    cost = card.get("cost")
    if not isinstance(cost, int):
        return errors
    ctype = card.get("type")
    text = f"{card.get('ability', '')} {card.get('effect', '')}"
    if ctype == "Character":
        atk = card.get("attack", 0)
        hp = card.get("health", 0)
        if not isinstance(atk, int) or not isinstance(hp, int):
            return errors
        body = atk + hp
        cap = cost + 1
        if body > cap:
            errors.append(
                f"{prefix}: Network body {atk}+{hp}={body} exceeds cap {cap} for cost {cost}"
            )
    if ctype == "Spell":
        import re

        deal = re.search(r"Deal (\d+) damage", text)
        if deal:
            amount = int(deal.group(1))
            flexible = any(word in text for word in ("Recycle", "Split", "Draw", "Flash"))
            cap = cost if flexible else max(0, cost - 1)
            if amount > cap:
                errors.append(
                    f"{prefix}: Network damage {amount} exceeds cap {cap} for cost {cost}"
                )
    return errors


def main() -> int:
    data_dir = Path(__file__).resolve().parent.parent / "data"
    cards_path = data_dir / "cards.json"

    if not cards_path.exists():
        print(f"ERROR: {cards_path} not found", file=sys.stderr)
        return 1

    with open(cards_path) as f:
        cards = json.load(f)

    if not isinstance(cards, list):
        print("ERROR: cards.json must be a JSON array", file=sys.stderr)
        return 1

    errors = validate_cards(cards)

    if errors:
        print(f"Found {len(errors)} validation error(s):\n")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"All {len(cards)} cards validated successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
