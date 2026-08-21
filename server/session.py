"""
Server-side game session management for Conspiracy TCG web play.

Keeps Game objects in memory keyed by session ID. Sessions are
ephemeral — they die when the server restarts.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from engine.decks import (
    build_deck,
    build_faction_deck,
    build_named_deck,
    load_card_lookup,
    load_encounters,
    validate_deck,
)
from engine.game import Game
from engine.models import Card

# ---------------------------------------------------------------------------
# Session store (in-memory, ephemeral)
# ---------------------------------------------------------------------------


@dataclass
class SessionInfo:
    """Metadata for a live game session."""

    game: Game
    player_name: str
    ai_name: str
    player_faction: str
    ai_faction: str
    difficulty: str
    mode: str
    encounter_id: str | None = None
    encounter: dict[str, Any] | None = None


_sessions: dict[str, SessionInfo] = {}


def _load_deck(faction: str) -> list[Card]:
    """
    Build a 30-card deck for the given faction using the curated deck list
    in data/decks.json.

    Falls back to auto-building from the faction card pool if no curated
    deck is defined.
    """
    return build_faction_deck(faction)


def create_session(
    player_name: str,
    player_faction: str,
    ai_faction: str,
    ai_name: str = "AI",
    *,
    difficulty: str = "medium",
    mode: str = "standard",
    encounter_id: str | None = None,
    player_deck_spec: list[dict[str, Any]] | list[str] | None = None,
    player_deck_id: str | None = None,
    ai_deck_id: str | None = None,
    first_player: int | None = None,
    shuffle: bool = True,
) -> str:
    """Create a new game session. Returns the session ID."""
    cards_by_id = load_card_lookup()
    encounter: dict[str, Any] | None = None

    if encounter_id:
        encounters = load_encounters()
        if encounter_id not in encounters:
            raise ValueError(f"Unknown encounter: {encounter_id}")
        encounter = encounters[encounter_id]
        mode = encounter.get("mode", mode)
        difficulty = encounter.get("difficulty", difficulty)
        player_faction = encounter.get("player_faction", player_faction)
        ai_faction = encounter.get("ai_faction", ai_faction)
        ai_name = encounter.get("ai_name", ai_name)
        if encounter.get("player_name") and player_name in ("Player", ""):
            player_name = encounter["player_name"]
        shuffle = bool(encounter.get("shuffle", shuffle))
        if encounter.get("player_goes_first") is True:
            first_player = 0
        elif encounter.get("player_goes_first") is False:
            first_player = 1

        if "player_deck" in encounter:
            player_deck = build_deck(encounter["player_deck"], cards_by_id)
        else:
            player_deck = build_faction_deck(
                encounter.get("player_deck_faction", player_faction), cards_by_id
            )
        if "ai_deck" in encounter:
            ai_deck = build_deck(encounter["ai_deck"], cards_by_id)
        else:
            ai_deck = build_faction_deck(
                encounter.get("ai_deck_faction", ai_faction), cards_by_id
            )
    elif player_deck_spec:
        check = validate_deck(
            player_deck_spec,
            cards_by_id,
            faction=player_faction,
            require_size=True,
            require_faction=True,
        )
        if not check["valid"]:
            raise ValueError("; ".join(check["errors"]))
        player_deck = build_deck(player_deck_spec, cards_by_id)
        ai_deck = (
            build_named_deck(ai_deck_id, cards_by_id) if ai_deck_id else _load_deck(ai_faction)
        )
    else:
        player_deck = (
            build_named_deck(player_deck_id, cards_by_id)
            if player_deck_id
            else _load_deck(player_faction)
        )
        ai_deck = (
            build_named_deck(ai_deck_id, cards_by_id) if ai_deck_id else _load_deck(ai_faction)
        )

    if not player_deck or not ai_deck:
        raise ValueError("Invalid faction selection")
    if len(player_deck) != 30:
        raise ValueError(f"Player deck has {len(player_deck)} cards (expected 30)")
    if len(ai_deck) != 30:
        raise ValueError(f"AI deck has {len(ai_deck)} cards (expected 30)")

    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    game = Game.setup(
        player_deck,
        ai_deck,
        player_name,
        ai_name,
        first_player=first_player,
        shuffle=shuffle,
        player1_faction=player_faction,
        player2_faction=ai_faction,
    )
    if encounter and encounter.get("ai_starting_life") is not None:
        for player in game.players:
            if player.name == ai_name:
                player.life = int(encounter["ai_starting_life"])
    session_id = str(uuid.uuid4())[:8]
    _sessions[session_id] = SessionInfo(
        game=game,
        player_name=player_name,
        ai_name=ai_name,
        player_faction=player_faction,
        ai_faction=ai_faction,
        difficulty=difficulty,
        mode=mode,
        encounter_id=encounter_id,
        encounter=encounter,
    )
    return session_id


def get_session(session_id: str) -> Game | None:
    """Get the Game for a session, or None if not found."""
    info = _sessions.get(session_id)
    return info.game if info else None


def get_session_info(session_id: str) -> SessionInfo | None:
    """Get full session metadata, or None if not found."""
    return _sessions.get(session_id)


def delete_session(session_id: str) -> None:
    """Remove a session."""
    _sessions.pop(session_id, None)


def list_sessions() -> list[str]:
    """List all active session IDs."""
    return list(_sessions.keys())
