"""
Combat resolution for Conspiracy TCG.

Implements Hearthstone-style combat:
  - Active player declares attacks with their characters.
  - Attacker chooses a target (enemy character or opponent directly).
  - Damage is dealt simultaneously to both characters.
  - Deaths are resolved after all attacks are declared.

Taunt and Stealth rules are enforced via engine.keywords.
"""

from __future__ import annotations

from engine.card import CardInstance
from engine.keywords import get_valid_attack_targets, remove_stealth
from engine.player import Player


class CombatResult:
    """
    Records the outcome of a single attack.
    """

    def __init__(
        self,
        attacker: CardInstance,
        defender: CardInstance | None,
        target_player: Player | None,
        damage_dealt_to_defender: int,
        damage_dealt_to_attacker: int,
        attacker_died: bool,
        defender_died: bool,
    ) -> None:
        self.attacker = attacker
        self.defender = defender  # None = attacking player directly
        self.target_player = target_player
        self.damage_dealt_to_defender = damage_dealt_to_defender
        self.damage_dealt_to_attacker = damage_dealt_to_attacker
        self.attacker_died = attacker_died
        self.defender_died = defender_died

    def __repr__(self) -> str:
        target = self.defender.name if self.defender else "opponent directly"
        return (
            f"Attack[{self.attacker.name} -> {target}: "
            f"dealt {self.damage_dealt_to_defender}, "
            f"took {self.damage_dealt_to_attacker}]"
        )


def resolve_attack(
    attacker: CardInstance,
    attacker_owner: Player,
    defender_owner: Player,
    defender: CardInstance | None = None,
) -> CombatResult:
    """
    Resolve a single attack.

    Args:
        attacker: The attacking character instance.
        attacker_owner: The player controlling the attacker.
        defender_owner: The defending player.
        defender: The defending character, or None for direct attack on player.

    Returns:
        CombatResult with full details of the exchange.

    Raises:
        ValueError: If the attacker cannot attack (exhausted, 0 attack, dead).
    """
    if not attacker.can_attack:
        raise ValueError(
            f"{attacker.name} cannot attack (exhausted={attacker.is_exhausted}, "
            f"attack={attacker.current_attack}, alive={attacker.is_alive})"
        )

    # Stealth breaks when attacking
    if attacker.is_stealth:
        remove_stealth(attacker)

    if defender is not None:
        # Character vs character combat — simultaneous damage
        atk_damage = attacker.current_attack
        def_damage = defender.current_attack

        defender.take_damage(atk_damage)
        attacker.take_damage(def_damage)

        attacker_died = not attacker.is_alive
        defender_died = not defender.is_alive

        result = CombatResult(
            attacker=attacker,
            defender=defender,
            target_player=defender_owner,
            damage_dealt_to_defender=atk_damage,
            damage_dealt_to_attacker=def_damage,
            attacker_died=attacker_died,
            defender_died=defender_died,
        )
    else:
        # Direct attack on the player
        atk_damage = attacker.current_attack
        defender_owner.direct_damage(atk_damage)

        result = CombatResult(
            attacker=attacker,
            defender=None,
            target_player=defender_owner,
            damage_dealt_to_defender=atk_damage,
            damage_dealt_to_attacker=0,
            attacker_died=False,
            defender_died=False,
        )

    # Attacker becomes exhausted after attacking
    attacker.mark_for_combat()

    return result


def get_valid_targets(
    attacker_owner: Player, defender_owner: Player
) -> list[CardInstance]:
    """
    Get all valid attack targets for a character.
    Returns the list of targetable enemy characters.
    If no characters are on the defending player's board, returns [].
    """
    return get_valid_attack_targets(attacker_owner, defender_owner)


def can_attack_player_directly(
    attacker_owner: Player, defender_owner: Player
) -> bool:
    """
    Check if the attacker can hit the opponent directly (no blocking characters).
    Returns True only if the defender has no board characters.
    """
    return len(defender_owner.board) == 0
