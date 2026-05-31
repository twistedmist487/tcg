"""
Server-side game session management for Conspiracy TCG web play.

Keeps Game objects in memory keyed by session ID. Sessions are
ephemeral — they die when the server restarts.
"""

from __future__ import annotations

import uuid
from typing import Optional

from engine.ai import AIPlayer, execute_turn
from engine.game import Game
from engine.models import load_cards


# ---------------------------------------------------------------------------
# Session store (in-memory, ephemeral)
# ---------------------------------------------------------------------------

_sessions: dict[str, Game] = {}


def create_session(
    player_name: str,
    player_faction: str,
    ai_faction: str,
    ai_name: str = "AI",
) -> str:
    """Create a new game session. Returns the session ID."""
    cards = load_cards("data/cards.json")

    # Filter cards by faction
    faction_cards = [c for c in cards if c.faction.value == player_faction]
    ai_cards = [c for c in cards if c.faction.value == ai_faction]
    if not faction_cards or not ai_cards:
        raise ValueError("Invalid faction selection")

    # Build decks from card pool (max 3 copies per card, up to 30 cards)
    player_deck: list = []
    ai_deck: list = []
    idx = 0
    max_copies = 3
    while len(player_deck) < 30:
        card = faction_cards[idx % len(faction_cards)]
        copies = sum(1 for c in player_deck if c.id == card.id)
        if copies < max_copies:
            player_deck.append(card)
        idx += 1
        # Safety: break if we've cycled through all cards enough times
        if idx > len(faction_cards) * max_copies + 10:
            break

    idx = 0
    while len(ai_deck) < 30:
        card = ai_cards[idx % len(ai_cards)]
        copies = sum(1 for c in ai_deck if c.id == card.id)
        if copies < max_copies:
            ai_deck.append(card)
        idx += 1
        if idx > len(ai_cards) * max_copies + 10:
            break

    game = Game.setup(player_deck, ai_deck, player_name, ai_name)
    session_id = str(uuid.uuid4())[:8]
    _sessions[session_id] = game
    return session_id


def get_session(session_id: str) -> Optional[Game]:
    """Get the Game for a session, or None if not found."""
    return _sessions.get(session_id)


def delete_session(session_id: str) -> None:
    """Remove a session."""
    _sessions.pop(session_id, None)


def list_sessions() -> list[str]:
    """List all active session IDs."""
    return list(_sessions.keys())
