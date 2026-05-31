# Phase 5: Web Playable Prototype Implementation Plan

> **Goal:** Browser-based UI with FastAPI backend for local web play.

**Architecture:**
- FastAPI server (`server/`) serves static files + REST API for game actions
- Existing `engine/` is imported directly (no engine changes needed)
- JSON game state flows: server keeps Game object in memory per session
- Frontend: single `index.html` with vanilla JS (no build step, no npm)
- Dark conspiracy-themed UI with card rendering and click-to-act gameplay

**API Design (stateless per-session via game_id cookie/session):**
- POST /api/game/new — creates game, returns game_id + state
- GET /api/game/{id}/state — returns full game state JSON
- POST /api/game/{id}/start-turn — starts the current turn
- POST /api/game/{id}/play — play a card {card_index}
- POST /api/game/{id}/attack — attack {attacker_index, target_index?}
- POST /api/game/{id}/end-turn — end current turn
- GET /api/cards — returns all card definitions

**File Layout:**
  server/
    __init__.py
    app.py          # FastAPI app + routes
    session.py      # In-memory game session store
  static/
    index.html       # Full SPA
    style.css        # Dark theme
    app.js           # Game UI logic
  tests/
    test_server.py   # API endpoint tests

**Tasks:**
1. Install fastapi + uvicorn + httpx (test client)
2. Write server/session.py — GameSession manager
3. Write server/app.py — FastAPI routes
4. Write static/index.html + style.css + app.js — frontend
5. Write tests/test_server.py — endpoint tests
6. Run all tests, update roadmap, commit
