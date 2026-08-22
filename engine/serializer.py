"""
JSON serialization and deserialization for Conspiracy TCG game state.

Saves and loads full game state to/from JSON. Used for:
  - Saving/resuming games
  - Replay functionality
  - Debug logging
"""

from __future__ import annotations

import json
from typing import Any

from engine.game import Game
from engine.models import Card, load_cards, load_factions
from engine.player import Player


def serialize_game(game: Game, indent: int | None = 2) -> str:
    """
    Serialize a Game to a JSON string.

    Args:
        game: The Game instance to serialize.
        indent: JSON indentation (None for compact, 2 for readable).

    Returns:
        JSON string representation.
    """
    state = game.get_state()

    # Add the serialized player decks/hands/boards for full state
    state["serialized_players"] = []
    for player in game.players:
        player_state = {
            "name": player.name,
            "faction": getattr(player, "faction", ""),
            "life": player.life,
            "energy": player.energy,
            "max_energy": player.max_energy,
            "fatigue_damage": player.fatigue_damage,
            "hero_power_used": getattr(player, "hero_power_used", False),
            "hand": [card_to_dict(c) for c in player.hand],
            "board": [card_instance_to_dict(c) for c in player.board],
            "deck": [card_to_dict(c) for c in player.deck],
            "location": (
                card_instance_to_dict(player.location)
                if player.location
                else None
            ),
        }
        state["serialized_players"].append(player_state)

    state["active_player_index"] = game.active_player_index
    state["turn_number"] = game.turn_number
    state["history"] = game.history

    return json.dumps(state, indent=indent, default=str)


def deserialize_game(json_str: str) -> Game:
    """
    Deserialize a Game from a JSON string.

    Reconstructs the full game state including decks, hands, and boards.

    Args:
        json_str: JSON string from serialize_game.

    Returns:
        Reconstructed Game instance.
    """
    state = json.loads(json_str)

    # Reconstruct players
    players = []
    for i, ps in enumerate(state["serialized_players"]):
        # Rebuild deck with Card objects
        deck = [dict_to_card(d) for d in ps["deck"]]
        player = Player(ps["name"], deck, faction=ps.get("faction"))
        player.life = ps["life"]
        player.energy = ps["energy"]
        player.max_energy = ps["max_energy"]
        player.fatigue_damage = ps["fatigue_damage"]
        player.hero_power_used = bool(ps.get("hero_power_used", False))

        # Restore hand
        player.hand = [dict_to_card(d) for d in ps["hand"]]

        # Restore board
        player.board = [
            dict_to_card_instance(di, ps["name"]) for di in ps["board"]
        ]

        # Restore location
        if ps.get("location"):
            player.location = dict_to_card_instance(
                ps["location"], ps["name"]
            )

        players.append(player)

    # Reconstruct game
    game = Game(players, first_player_index=state.get("active_player_index", 0))
    game.turn_number = state.get("turn_number", 0)
    game.winner = state.get("winner")
    game.history = state.get("history", [])
    game.turn_started = state.get("turn_started", False)

    return game


def card_to_dict(card: Card) -> dict[str, Any]:
    """Convert a Card to a plain dict for serialization."""
    result: dict[str, Any] = {
        "id": card.id,
        "name": card.name,
        "faction": card.faction.value,
        "energy_type": card.energy_type.value,
        "cost": card.cost,
        "lore": card.lore,
    }

    card_type = card.type.value if hasattr(card, "type") else ""
    result["type"] = card_type

    if card_type == "Character":
        result["attack"] = card.attack  # type: ignore
        result["health"] = card.health  # type: ignore
        result["ability"] = card.ability  # type: ignore
    elif card_type == "Spell":
        result["effect"] = card.effect  # type: ignore
    elif card_type == "Location":
        result["effect"] = card.effect  # type: ignore

    return result


def dict_to_card(d: dict[str, Any]) -> Card:
    """Convert a plain dict back to a Card (with runtime defaults)."""
    ctype = d.get("type", "")
    if ctype == "Character":
        return {
            "id": d["id"],
            "name": d["name"],
            "type": "Character",
            "faction": d["faction"],
            "energy_type": d["energy_type"],
            "cost": d["cost"],
            "lore": d.get("lore", ""),
            "attack": d.get("attack", 0),
            "health": d.get("health", 1),
            "ability": d.get("ability", ""),
        }  # type: ignore
    elif ctype == "Spell":
        return {
            "id": d["id"],
            "name": d["name"],
            "type": "Spell",
            "faction": d["faction"],
            "energy_type": d["energy_type"],
            "cost": d["cost"],
            "lore": d.get("lore", ""),
            "effect": d.get("effect", ""),
        }  # type: ignore
    else:
        return {
            "id": d["id"],
            "name": d["name"],
            "type": "Location",
            "faction": d["faction"],
            "energy_type": d["energy_type"],
            "cost": d["cost"],
            "lore": d.get("lore", ""),
            "effect": d.get("effect", ""),
        }  # type: ignore


def card_instance_to_dict(instance: "CardInstance") -> dict[str, Any]:
    """Convert a CardInstance to a plain dict."""
    from engine.card import Card as CardType

    return {
        "card": card_to_dict(instance.card),
        "instance_id": instance.instance_id,
        "owner": instance.owner,
        "damage_taken": instance.damage_taken,
        "is_exhausted": instance.is_exhausted,
        "is_stealth": instance.is_stealth,
        "is_silenced": instance.is_silenced,
        "attack_bonus": instance.attack_bonus,
        "health_bonus": instance.health_bonus,
        "buffs": instance.buffs,
    }


def dict_to_card_instance(
    d: dict[str, Any], owner: str = ""
) -> "CardInstance":
    """Convert a plain dict back to a CardInstance."""
    from engine.card import create_card_instance
    from engine.models import CharacterCard, SpellCard, LocationCard

    card_dict = d["card"]
    raw_card: Card = dict_to_card(card_dict)

    card_type = card_dict.get("type", "")
    if card_type == "Character":
        card = CharacterCard(**raw_card)
    elif card_type == "Spell":
        card = SpellCard(**raw_card)
    else:
        card = LocationCard(**raw_card)

    inst = create_card_instance(card, d["instance_id"], d.get("owner", owner))
    inst.damage_taken = d.get("damage_taken", 0)
    inst.is_exhausted = d.get("is_exhausted", inst.is_exhausted)
    inst.is_stealth = d.get("is_stealth", inst.is_stealth)
    inst.is_silenced = d.get("is_silenced", False)
    inst.attack_bonus = d.get("attack_bonus", 0)
    inst.health_bonus = d.get("health_bonus", 0)
    inst.buffs = d.get("buffs", [])
    return inst
