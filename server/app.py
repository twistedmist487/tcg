"""
FastAPI web server for Conspiracy TCG.

Serves the frontend and provides REST API endpoints for game actions.
Run with: uvicorn server.app:app --reload --port 8080
"""

from __future__ import annotations

import random
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from engine.models import load_cards
from server.session import (
    create_session,
    delete_session,
    get_session,
    list_sessions,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Conspiracy TCG", version="0.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (frontend)
static_dir = Path(__file__).resolve().parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# ---------------------------------------------------------------------------
# Card data endpoint (for frontend card display)
# ---------------------------------------------------------------------------


@app.get("/api/cards")
def get_cards() -> list[dict[str, Any]]:
    """Return all card definitions."""
    cards = load_cards("data/cards.json")
    result = []
    for card in cards:
        d: dict[str, Any] = {
            "id": card.id,
            "name": card.name,
            "faction": card.faction.value,
            "energy_type": card.energy_type.value,
            "cost": card.cost,
            "lore": card.lore,
        }
        ctype = card.type.value if hasattr(card, "type") else ""
        d["type"] = ctype
        if ctype == "Character":
            d["attack"] = card.attack  # type: ignore
            d["health"] = card.health  # type: ignore
            d["ability"] = card.ability  # type: ignore
        elif ctype == "Spell" or ctype == "Location":
            d["effect"] = card.effect  # type: ignore
        result.append(d)
    return result


# ---------------------------------------------------------------------------
# Game session endpoints
# ---------------------------------------------------------------------------


@app.post("/api/game/new")
def new_game(
    player_name: str = "Player",
    player_faction: str = "illuminati",
    ai_faction: str = "templars",
    ai_name: str | None = None,
) -> dict[str, Any]:
    """Create a new game session."""
    if player_faction == ai_faction:
        # Pick a different faction for AI
        factions = ["illuminati", "templars", "reptilians"]
        factions.remove(player_faction)
        ai_faction = random.choice(factions)

    if not ai_name:
        ai_name = random.choice(["Overmind", "Admiral Vex", "Agent Smith", "Archon"])

    session_id = create_session(player_name, player_faction, ai_faction, ai_name)
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=500, detail="Failed to create game")

    return {
        "session_id": session_id,
        "state": game.get_state(),
        "ai_name": ai_name,
        "ai_faction": ai_faction,
        "active_player_index": game.active_player_index,
        "player_names": [p.name for p in game.players],
    }


@app.get("/api/game/{session_id}/state")
def get_state(session_id: str) -> dict[str, Any]:
    """Get the current game state."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return game.get_state()


@app.post("/api/game/{session_id}/start-turn")
def start_turn(session_id: str) -> dict[str, Any]:
    """Start the current player's turn."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    result = game.start_turn()
    return {"turn_result": result, "state": game.get_state()}


@app.post("/api/game/{session_id}/play")
def play_card(
    session_id: str, card_index: int, spell_target_index: int | None = None
) -> dict[str, Any]:
    """Play a card from hand."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    result = game.play_card(card_index, spell_target_index=spell_target_index)
    return {"action_result": result, "state": game.get_state()}


@app.post("/api/game/{session_id}/attack")
def attack(
    session_id: str,
    attacker_index: int,
    target_index: int | None = None,
) -> dict[str, Any]:
    """Declare an attack."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    result = game.attack(attacker_index, target_index)
    return {"action_result": result, "state": game.get_state()}


@app.post("/api/game/{session_id}/end-turn")
def end_turn(session_id: str) -> dict[str, Any]:
    """End the current turn."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    result = game.end_turn()
    return {"turn_result": result, "state": game.get_state()}


@app.delete("/api/game/{session_id}")
def destroy_game(session_id: str) -> dict[str, str]:
    """Delete a game session."""
    delete_session(session_id)
    return {"status": "deleted"}


@app.get("/api/sessions")
def get_sessions() -> list[str]:
    """List all active sessions."""
    return list_sessions()


# ---------------------------------------------------------------------------
# Frontend serving
# ---------------------------------------------------------------------------


@app.get("/", response_class=HTMLResponse)
def root() -> str:
    """Serve the frontend."""
    index_file = static_dir / "index.html"
    if index_file.exists():
        return index_file.read_text()
    return "<h1>Conspiracy TCG Server</h1><p>Static files not found.</p>"
