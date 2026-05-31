# Phase 4: Single-Player vs AI Implementation Plan

> **Goal:** A heuristic AI opponent that can play Conspiracy TCG against a human player.

**Architecture:** A rule-based heuristic AI agent that scores board states and picks the best action each turn. No ML — pure Hearthstone-style priority evaluation with faction-specific weights.

**Tech Stack:** Pure Python, no new dependencies. Integrates with existing Game/Player/Combat engine.

---

### Task 1: Write the AI agent

**Files:**
- Create: `engine/ai.py`
- Test: `tests/test_ai.py`

The AI agent will:
1. Read `game.get_state()` + `game.active_player` / `game.inactive_player`
2. Score all possible actions (play card, attack, end turn)
3. Pick the highest-scoring valid action
4. Repeat until it ends turn

Scoring heuristics:
- **Board presence** — playing characters is generally good (weighted by cost efficiency)
- **Attack priority** — kill enemy characters if possible, otherwise attack face
- **Target selection** — prioritize high-threat enemy characters (high attack, low health)
- **Taunt awareness** — must respect Taunt rules via `get_valid_attack_targets`
- **Energy efficiency** — avoid wasting energy, try to play highest-cost affordable card
- **Face vs board tradeoff** — attack face when no good trades available

Faction flavor weights (tunable):
- Illuminati: values card draw, board control, disruption
- Templars: values healing, taunts, efficient trades
- Reptilians: values stealth, disruption, aggressive trades

### Task 2: Write failing tests for AI behavior

**Test: `tests/test_ai.py`**

Tests:
- AI can make a play decision (doesn't crash)
- AI plays highest-cost affordable card when board empty
- AI attacks enemy characters before attacking face
- AI respects Taunt when choosing targets
- AI ends turn when no good actions remain
- AI can complete a full game loop without errors
- AI plays cards from hand before passing

### Task 3: Implement AI agent

**Build `engine/ai.py`:**

Key functions:
- `choose_action(game: Game) -> dict` — returns action dict
- `_score_play_card(game, card_index) -> float` — scores playing a card
- `_score_attack(game, attacker_idx, target_idx) -> float` — scores an attack
- `_score_end_turn(game) -> float` — when to pass
- `execute_turn(game) -> list[dict]` — full AI turn loop

### Task 4: Create single-player CLI mode

**Files:**
- Modify: `cli/game.py`

Add mode selection at startup:
- `[1] Two players` (existing)
- `[2] vs AI` (new)

For vs AI, human picks faction and AI randomly picks from the other two.

### Task 5: Validate and test

- Run `make validate` — confirm all 27 cards still valid
- Run `python3 -m pytest tests/ -v` — confirm all tests pass
- Run `python3 -m cli/game.py` and play a quick game vs AI manually
- Update roadmap
