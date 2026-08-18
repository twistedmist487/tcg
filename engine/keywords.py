"""
Keyword mechanics for Conspiracy TCG.

Implements the core keywords:
  - Taunt: Enemy characters must attack a Taunt character if able.
  - Stealth: Cannot be targeted by enemy attacks or abilities until it attacks.
  - Charge: Can attack the turn it is played.
  - Silence: Removes all abilities from a character or location.
  - Exhausted: Cannot attack or use abilities the turn it's played/attacks.

All keyword functions are pure — they take game state and return modified state.
"""

from __future__ import annotations

from engine.card import CardInstance


def has_taunt(character: CardInstance) -> bool:
    """Check if a character has the Taunt keyword."""
    return character.has_taunt


def has_charge(character: CardInstance) -> bool:
    """Check if a character has Charge (ready the turn it is played)."""
    return bool(getattr(character, "has_charge", False))


def has_stealth(character: CardInstance) -> bool:
    """Check if a character currently has Stealth active."""
    return character.is_stealth


def is_silenced(character: CardInstance) -> bool:
    """Check if a character is silenced (abilities suppressed)."""
    return character.is_silenced


def is_exhausted(character: CardInstance) -> bool:
    """Check if a character is exhausted and cannot attack."""
    return character.is_exhausted


def get_valid_attack_targets(attacker_owner: Player, defender: Player) -> list[CardInstance]:
    """
    Return the list of characters on the defender's board that the attacker
    is allowed to target. Implements Taunt and Stealth rules.

    Rules:
      - If the defender has ANY Taunt character, the attacker must target one
        of those Taunt characters (non-Taunt are invalid targets).
      - Stealth characters cannot be targeted while they have Stealth active.
      - Exhausted status does not affect target selection (only attack eligibility).
    """
    defender_board = defender.board

    if not defender_board:
        return []

    # Stealth characters cannot be targeted
    targetable = [c for c in defender_board if not has_stealth(c)]

    # If any Taunt character is present and targetable, restrict to Taunt targets
    taunt_targets = [c for c in targetable if has_taunt(c)]

    if taunt_targets:
        return taunt_targets

    return targetable


def apply_silence(character: CardInstance) -> None:
    """Silence a character — suppress all abilities."""
    character.is_silenced = True
    character.silence_turns_remaining = -1  # permanent until explicitly cleared


def clear_silence(character: CardInstance) -> None:
    """Remove silence from a character."""
    character.is_silenced = False
    character.silence_turns_remaining = 0


def apply_exhausted(character: CardInstance) -> None:
    """Mark a character as exhausted (cannot attack this turn)."""
    character.is_exhausted = True


def clear_all_exhaustion(game: Game, player: Player) -> None:
    """Clear exhaustion and per-turn attack locks at the start of a turn."""
    for character in player.board:
        character.is_exhausted = False
        character.rush_locked = False
        character.attacks_this_turn = 0


def remove_stealth(character: CardInstance) -> None:
    """Remove stealth from a character (called when it attacks)."""
    character.is_stealth = False
