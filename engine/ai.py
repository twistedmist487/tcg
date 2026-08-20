"""
Heuristic AI opponent for Conspiracy TCG.

A rule-based agent that scores all possible actions each turn and picks
the highest-scoring one. No ML — pure priority evaluation inspired by
Hearthstone AI design.

Key design principles:
- Action space: play card, attack character, attack face, end turn
- Scoring: weighted sum of board state evaluation terms
- Faction flavor: different weights per faction for variety
- Safe: never suggests invalid actions (validated before execution)
"""

from __future__ import annotations

import math
import random
from typing import Any

from engine.card import CardInstance
from engine.combat import can_attack_player_directly
from engine.game import Game
from engine.keywords import get_valid_attack_targets, has_taunt
from engine.models import Card
from engine.player import Player

DIFFICULTY_PRESETS: dict[str, dict[str, float]] = {
    # Easy never skips attacks; Recruiter must poke face so First Contact cannot stall.
    "easy": {
        "aggression": 0.2,
        "mistake_chance": 0.4,
        "skip_attack_chance": 0.0,
        "poke_face": 1.0,
    },
    "medium": {
        "aggression": 0.5,
        "mistake_chance": 0.0,
        "skip_attack_chance": 0.0,
        "poke_face": 0.35,
    },
}

MAX_RECYCLES_PER_TURN = 2
