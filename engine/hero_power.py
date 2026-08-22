"""
Faction powers — once per turn, cost 2, unique per starting identity.

Illuminati  Pull Strings   Deal 1 to a character or hero.
Templars    Call Initiate  Summon a 1/1 Taunt token.
Reptilians  Psi Lash       Deal 2 to the enemy hero.
"""

from __future__ import annotations

from typing import Any

from engine.models import HeroPower, load_factions

_CACHE: dict[str, HeroPower | None] | None = None


def _load() -> dict[str, HeroPower | None]:
    global _CACHE
    if _CACHE is None:
        factions = load_factions("data/factions.json")
        _CACHE = {key: fac.hero_power for key, fac in factions.items()}
    return _CACHE


def power_for(faction: str | None) -> HeroPower | None:
    """Return the faction power definition, or None for Network / unknown."""
    if not faction:
        return None
    return _load().get(faction)


def power_dict(faction: str | None, *, used: bool, energy: int, turn_started: bool) -> dict[str, Any] | None:
    """UI-facing snapshot of a player's power."""
    power = power_for(faction)
    if power is None:
        return None
    affordable = energy >= power.cost
    return {
        "id": power.id,
        "name": power.name,
        "cost": power.cost,
        "effect": power.effect,
        "target": power.target,
        "lore": power.lore,
        "used": used,
        "available": bool(turn_started and not used and affordable),
    }
