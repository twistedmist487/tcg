"""
Server-side game session management for Conspiracy TCG web play.

Keeps Game objects in memory keyed by session ID. Sessions are
ephemeral — they die when the server restarts.
"""

from __future__ import annotations

import uuid

from engine.game import Game
from engine.models import Card, load_cards

# ---------------------------------------------------------------------------
# Session store (in-memory, ephemeral)
# ---------------------------------------------------------------------------

_sessions: dict[str, Game] = {}


def _load_deck(faction: str) -> list[Card]:
    """
    Build a 30-card deck for the given faction using the curated deck list
    in data/decks.json.

    Falls back to auto-building from the faction card pool if no curated
    deck is defined.
    """
    all_cards = load_cards("data/cards.json")
    card_lookup = {c.id: c for c in all_cards}
    faction_cards = {c.id: c for c in all_cards if c.faction.value == faction}

    # Try loading curated deck
    try:
        import json
        from pathlib import Path

        decks_path = Path(__file__).resolve().parent.parent / "data" / "decks.json"
        if decks_path.exists():
            with open(decks_path) as f:
                curated = json.load(f)
            if faction in curated:
                deck: list[Card] = []
                for entry in curated[faction]["cards"]:
                    card_id = entry["id"]
                    copies = entry["copies"]
                    if card_id not in card_lookup:
                        raise ValueError(f"Deck references unknown card ID: {card_id}")
                    for _ in range(copies):
                        deck.append(card_lookup[card_id])
                return deck
    except (FileNotFoundError, KeyError, ValueError):
        pass

    # Fallback: auto-build from faction card pool
    pool = list(faction_cards.values())
    deck: list[Card] = []
    idx = 0
    max_copies = 3
    while len(deck) < 30:
        card = pool[idx % len(pool)]
        copies = sum(1 for c in deck if c.id == card.id)
        if copies < max_copies:
            deck.append(card)
        idx += 1
        if idx > len(pool) * max_copies + 10:
            break
    return deck


def create_session(
    player_name: str,
    player_faction: str,
    ai_faction: str,
    ai_name: str = "AI",
) -> str:
    """Create a new game session. Returns the session ID."""
    player_deck = _load_deck(player_faction)
    ai_deck = _load_deck(ai_faction)

    if not player_deck or not ai_deck:
        raise ValueError("Invalid faction selection")
    if len(player_deck) != 30:
        raise ValueError(f"Player deck has {len(player_deck)} cards (expected 30)")
    if len(ai_deck) != 30:
        raise ValueError(f"AI deck has {len(ai_deck)} cards (expected 30)")

    game = Game.setup(player_deck, ai_deck, player_name, ai_name)
    session_id = str(uuid.uuid4())[:8]
    _sessions[session_id] = game
    return session_id


def get_session(session_id: str) -> Game | None:
    """Get the Game for a session, or None if not found."""
    return _sessions.get(session_id)


def delete_session(session_id: str) -> None:
    """Remove a session."""
    _sessions.pop(session_id, None)


def list_sessions() -> list[str]:
    """List all active session IDs."""
    return list(_sessions.keys())
