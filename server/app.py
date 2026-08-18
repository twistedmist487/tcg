"""
FastAPI web server for Conspiracy TCG.

Serves the frontend and provides REST API endpoints for game actions.
Run with: uvicorn server.app:app --reload --port 8080
"""

from __future__ import annotations

import random
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from engine.ai import AIPlayer, execute_turn
from engine.decks import load_curated_decks, load_encounters, validate_deck
from engine.models import load_cards
from server.session import (
    create_session,
    delete_session,
    get_session,
    get_session_info,
    list_sessions,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Conspiracy TCG", version="0.8.0")

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


class DeckValidateBody(BaseModel):
    """Request body for deck validation."""

    faction: str
    cards: list[dict[str, Any]]


@app.get("/api/decks")
def get_decks() -> dict[str, Any]:
    """Return curated 30-card faction decks."""
    return load_curated_decks()


@app.post("/api/decks/validate")
def validate_deck_endpoint(body: DeckValidateBody) -> dict[str, Any]:
    """Validate a 30-card single-faction deck."""
    return validate_deck(body.cards, faction=body.faction)


@app.get("/api/encounters")
def get_encounters() -> list[dict[str, Any]]:
    """Return tutorial and showcase encounter summaries."""
    raw = load_encounters()
    result = []
    for encounter in raw.values():
        result.append(
            {
                "id": encounter["id"],
                "name": encounter["name"],
                "description": encounter["description"],
                "mode": encounter.get("mode", "showcase"),
                "player_faction": encounter.get("player_faction"),
                "ai_faction": encounter.get("ai_faction"),
                "difficulty": encounter.get("difficulty", "medium"),
                "steps": encounter.get("steps"),
            }
        )
    return result


def _session_payload(session_id: str) -> dict[str, Any]:
    info = get_session_info(session_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Session not found")
    game = info.game
    payload: dict[str, Any] = {
        "session_id": session_id,
        "state": game.get_state(),
        "ai_name": info.ai_name,
        "ai_faction": info.ai_faction,
        "player_name": info.player_name,
        "player_faction": info.player_faction,
        "difficulty": info.difficulty,
        "mode": info.mode,
        "encounter_id": info.encounter_id,
        "active_player_index": game.active_player_index,
        "player_names": [p.name for p in game.players],
    }
    if info.encounter:
        payload["encounter"] = {
            "id": info.encounter.get("id"),
            "name": info.encounter.get("name"),
            "description": info.encounter.get("description"),
            "steps": info.encounter.get("steps", []),
        }
    if game.is_over:
        payload["recap"] = game.get_recap(info.player_name)
    return payload


@app.post("/api/game/new")
async def new_game(
    request: Request,
    player_name: str = "Player",
    player_faction: str = "illuminati",
    ai_faction: str = "templars",
    ai_name: str | None = None,
    difficulty: str = "medium",
    mode: str = "standard",
    encounter_id: str | None = None,
) -> dict[str, Any]:
    """Create a new game session (standard, tutorial, or showcase)."""
    body: dict[str, Any] = {}
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        raw = await request.body()
        if raw:
            import json as json_lib

            body = json_lib.loads(raw)

    player_name = body.get("player_name") or player_name
    player_faction = body.get("player_faction") or player_faction
    ai_faction = body.get("ai_faction") or ai_faction
    ai_name = body.get("ai_name") or ai_name
    difficulty = body.get("difficulty") or difficulty
    mode = body.get("mode") or mode
    encounter_id = body.get("encounter_id") or encounter_id
    player_deck = body.get("player_deck")
    player_deck_id = body.get("player_deck_id")
    ai_deck_id = body.get("ai_deck_id")

    if player_faction == ai_faction and not encounter_id and not player_deck and not player_deck_id:
        factions = ["illuminati", "templars", "reptilians"]
        factions.remove(player_faction)
        ai_faction = random.choice(factions)

    if not ai_name:
        ai_name = random.choice(["Overmind", "Admiral Vex", "Agent Smith", "Archon"])

    try:
        session_id = create_session(
            player_name,
            player_faction,
            ai_faction,
            ai_name,
            difficulty=difficulty,
            mode=mode,
            encounter_id=encounter_id,
            player_deck_spec=player_deck,
            player_deck_id=player_deck_id,
            ai_deck_id=ai_deck_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _session_payload(session_id)


@app.post("/api/game/{session_id}/mulligan")
async def mulligan(session_id: str, player_name: str, request: Request) -> dict[str, Any]:
    """Perform mulligan: return selected cards to deck and draw replacements."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    indices: list[int] = []
    raw = await request.body()
    if raw:
        import json as json_lib

        parsed = json_lib.loads(raw)
        if isinstance(parsed, list):
            indices = [int(i) for i in parsed]
        elif isinstance(parsed, dict):
            indices = [int(i) for i in parsed.get("card_indices", [])]
    result = game.mulligan(player_name, indices)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Mulligan failed"))
    return {"mulligan_result": result, "state": game.get_state()}


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
    session_id: str,
    card_index: int,
    spell_target_index: int | None = None,
    target_side: str = "enemy",
) -> dict[str, Any]:
    """Play a card from hand.

    target_side: "enemy" (default), "ally", or "hero".
    spell_target_index: board index when side is enemy/ally; ignored for hero.
    """
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    side = (target_side or "enemy").lower()
    if side not in ("enemy", "ally", "hero"):
        side = "enemy"
    result = game.play_card(
        card_index,
        spell_target_index=spell_target_index,
        target_side=side,
    )
    return {"action_result": result, "state": game.get_state()}


@app.post("/api/game/{session_id}/recycle")
async def recycle(session_id: str, request: Request) -> dict[str, Any]:
    """Shuffle a Recycle card back into the deck and draw."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    index = 0
    raw = await request.body()
    if raw:
        import json as json_lib

        parsed = json_lib.loads(raw)
        if isinstance(parsed, dict):
            index = int(parsed.get("card_index", parsed.get("index", 0)))
        else:
            index = int(parsed)
    result = game.recycle(index)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Recycle failed"))
    return {"recycle_result": result, "state": game.get_state()}


@app.post("/api/game/{session_id}/split")
async def split_choice(session_id: str, request: Request) -> dict[str, Any]:
    """Choose one option from a Split card."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    index = 0
    target_index: int | None = None
    raw = await request.body()
    if raw:
        import json as json_lib

        parsed = json_lib.loads(raw)
        if isinstance(parsed, dict):
            index = int(parsed.get("index", 0))
            if parsed.get("target_index") is not None:
                target_index = int(parsed["target_index"])
        else:
            index = int(parsed)
    result = game.choose_split(index, target_index=target_index)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Split failed"))
    return {"split_result": result, "state": game.get_state()}


@app.post("/api/game/{session_id}/discover")
async def discover(session_id: str, request: Request) -> dict[str, Any]:
    """Choose one of the three Discovered cards."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")
    index = 0
    raw = await request.body()
    if raw:
        import json as json_lib

        parsed = json_lib.loads(raw)
        if isinstance(parsed, dict):
            index = int(parsed.get("index", 0))
        else:
            index = int(parsed)
    result = game.choose_discovery(index)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Discovery failed"))
    return {"discover_result": result, "state": game.get_state()}


@app.post("/api/game/{session_id}/attack")
async def attack(session_id: str, request: Request) -> dict[str, Any]:
    """Declare an attack. Accepts JSON body or query parameters."""
    game = get_session(session_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Session not found")

    attacker_index: int | None = None
    target_index: int | None = None
    raw = await request.body()
    if raw:
        import json as json_lib

        parsed = json_lib.loads(raw)
        if isinstance(parsed, dict):
            if parsed.get("attacker_index") is not None:
                attacker_index = int(parsed["attacker_index"])
            if "target_index" in parsed:
                target_index = parsed["target_index"]
                if target_index is not None:
                    target_index = int(target_index)
    if attacker_index is None and "attacker_index" in request.query_params:
        attacker_index = int(request.query_params["attacker_index"])
    if target_index is None and "target_index" in request.query_params:
        raw_target = request.query_params["target_index"]
        target_index = None if raw_target in ("", "null") else int(raw_target)

    if attacker_index is None:
        raise HTTPException(status_code=422, detail="attacker_index is required")

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


@app.post("/api/game/{session_id}/ai-turn")
def ai_turn(session_id: str) -> dict[str, Any]:
    """Run the AI opponent's full turn using the session difficulty."""
    info = get_session_info(session_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Session not found")
    game = info.game
    if game.is_over:
        return {
            "results": [],
            "state": game.get_state(),
            "recap": game.get_recap(info.player_name),
        }
    if game.active_player.name == info.player_name:
        raise HTTPException(status_code=400, detail="Not the AI's turn")

    if not game.turn_started:
        start_result = game.start_turn()
        if game.is_over:
            return {
                "results": [{"action": "start_turn", "result": start_result}],
                "state": game.get_state(),
                "recap": game.get_recap(info.player_name),
            }

    ai = AIPlayer(
        name=info.ai_name,
        faction=info.ai_faction,
        difficulty=info.difficulty,
    )
    results = execute_turn(game, ai)
    payload: dict[str, Any] = {"results": results, "state": game.get_state()}
    if game.is_over:
        payload["recap"] = game.get_recap(info.player_name)
    return payload


@app.get("/api/game/{session_id}/recap")
def get_recap(session_id: str) -> dict[str, Any]:
    """Return the post-match recap for the human player."""
    info = get_session_info(session_id)
    if info is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return info.game.get_recap(info.player_name)


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
