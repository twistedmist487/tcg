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
        atk_damage = attacker.current_attack
        def_damage = defender.current_attack
        def_before = defender.current_health
        atk_before = attacker.current_health

        dealt_to_def = defender.take_damage(atk_damage)
        dealt_to_atk = attacker.take_damage(def_damage)

        if attacker.has_venom and not attacker.is_silenced and dealt_to_def > 0:
            defender.damage_taken = defender._base_health + defender.health_bonus
        if defender.has_venom and not defender.is_silenced and dealt_to_atk > 0:
            attacker.damage_taken = attacker._base_health + attacker.health_bonus

        if attacker.has_drain and not attacker.is_silenced and dealt_to_def > 0:
            attacker_owner.life = min(Player.STARTING_LIFE, attacker_owner.life + dealt_to_def)
        if defender.has_drain and not defender.is_silenced and dealt_to_atk > 0:
            defender_owner.life = min(Player.STARTING_LIFE, defender_owner.life + dealt_to_atk)

        if attacker.has_excess and not attacker.is_silenced and atk_damage > def_before > 0:
            attacker.buffs.append("excess_ready")
        if defender.has_excess and not defender.is_silenced and def_damage > atk_before > 0:
            defender.buffs.append("excess_ready")

        attacker_died = not attacker.is_alive
        defender_died = not defender.is_alive

        result = CombatResult(
            attacker=attacker,
            defender=defender,
            target_player=defender_owner,
            damage_dealt_to_defender=dealt_to_def,
            damage_dealt_to_attacker=dealt_to_atk,
            attacker_died=attacker_died,
            defender_died=defender_died,
        )
    else:
        atk_damage = attacker.current_attack
        dealt = defender_owner.direct_damage(atk_damage)
        if attacker.has_drain and not attacker.is_silenced and dealt > 0:
            attacker_owner.life = min(Player.STARTING_LIFE, attacker_owner.life + dealt)

        result = CombatResult(
            attacker=attacker,
            defender=None,
            target_player=defender_owner,
            damage_dealt_to_defender=dealt,
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
    Check if the attacker can hit the opponent directly.

    Face is legal when there are no targetable enemy characters: empty
    board, or only Stealth (Stealth cannot be attacked, so it does not
    block a direct attack). Taunt that is not stealthed still blocks face.
    """
    return len(get_valid_attack_targets(attacker_owner, defender_owner)) == 0
