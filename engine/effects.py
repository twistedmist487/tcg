"""
Effect resolution engine for Conspiracy TCG.

Implements a data-driven effect system that reads card ability/effect text
and dispatches to the appropriate handler functions.

Design:
  - Each effect is a function that takes (game, caster, target, params) and
    returns an EffectResult describing what happened.
  - The EffectResolver class parses card text to determine which effects to
    fire, and resolves them in order.
  - Trigger types: on_play, on_attack, on_death, start_of_turn, end_of_turn,
    ongoing (aura), on_damaged.

All effect functions are pure with respect to game state — they mutate only
what they're supposed to and log everything into the result.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from engine.card import CardInstance
from engine.keywords import apply_silence
from engine.models import Card, SpellCard
from engine.player import Player

if TYPE_CHECKING:
    from engine.game import Game


# ---------------------------------------------------------------------------
# Effect result
# ---------------------------------------------------------------------------


@dataclass
class EffectResult:
    """Result of resolving one card effect."""

    effect_type: str
    success: bool
    description: str = ""
    damage_dealt: dict[str, int] = field(default_factory=dict)
    healing_done: dict[str, int] = field(default_factory=dict)
    cards_drawn: dict[str, int] = field(default_factory=dict)
    silenced: list[str] = field(default_factory=list)
    bounced: list[str] = field(default_factory=list)
    destroyed: list[str] = field(default_factory=list)
    stolen: list[str] = field(default_factory=list)
    buffs_applied: list[str] = field(default_factory=list)
    debuffs_applied: list[str] = field(default_factory=dict)
    discarded: dict[str, list[str]] = field(default_factory=dict)
    energy_gained: dict[str, int] = field(default_factory=dict)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to a serializable dict."""
        return {
            k: v
            for k, v in {
                "effect_type": self.effect_type,
                "success": self.success,
                "description": self.description,
                "damage_dealt": self.damage_dealt,
                "healing_done": self.healing_done,
                "cards_drawn": self.cards_drawn,
                "silenced": self.silenced,
                "bounced": self.bounced,
                "destroyed": self.destroyed,
                "stolen": self.stolen,
                "buffs_applied": self.buffs_applied,
                "debuffs_applied": self.debuffs_applied,
                "discarded": self.discarded,
                "energy_gained": self.energy_gained,
            }.items()
            if v
        }


# ---------------------------------------------------------------------------
# Helper: deal damage to a character instance
# ---------------------------------------------------------------------------


def _deal_damage(target: CardInstance, amount: int) -> int:
    """Deal damage to a character. Returns actual damage dealt."""
    if amount <= 0:
        return 0
    target.take_damage(amount)
    return amount


# ---------------------------------------------------------------------------
# Helpers: find target instances from game state
# ---------------------------------------------------------------------------


def _get_enemy_characters(game: Game, caster_name: str) -> list[CardInstance]:
    """Get all enemy character instances for the caster."""
    for p in game.players:
        if p.name != caster_name:
            return list(p.board)
    return []


def _get_own_characters(game: Game, caster_name: str) -> list[CardInstance]:
    """Get all friendly character instances for the caster."""
    for p in game.players:
        if p.name == caster_name:
            return list(p.board)
    return []


def _get_player(game: Game, name: str) -> Player | None:
    """Look up a player by name."""
    for p in game.players:
        if p.name == name:
            return p
    return None


# ---------------------------------------------------------------------------
# Spell effect handlers
# ---------------------------------------------------------------------------


def resolve_spell_damage(
    game: Game, caster_name: str, spell: SpellCard, target_instance: CardInstance | None = None
) -> EffectResult:
    """
    Resolve a simple 'Deal N damage to target character' spell.
    Used by: Divine Smite (4), Holy Inquisition (3).
    """
    result = EffectResult(effect_type="damage", success=False)
    effect_text = spell.effect

    # Parse damage amount
    match = re.search(r"Deal (\d+) damage", effect_text)
    if not match:
        return result

    damage = int(match.group(1))

    if target_instance is None:
        result.description = f"{spell.name}: no target selected"
        return result

    actual = _deal_damage(target_instance, damage)
    result.success = True
    result.damage_dealt = {target_instance.name: actual}
    result.description = f"{spell.name} deals {actual} damage to {target_instance.name}"

    return result


def resolve_damage_all_enemies(
    game: Game, caster_name: str, spell: SpellCard, target_instance: CardInstance | None = None
) -> EffectResult:
    """
    Resolve AOE damage spells.
    Used by: Ancient Star Map (2 to all), Orbital Strike (6 to target + 3 to others).
    """
    result = EffectResult(effect_type="aoe_damage", success=False)
    effect_text = spell.effect

    enemies = _get_enemy_characters(game, caster_name)
    if not enemies:
        result.description = f"{spell.name}: no enemy characters"
        return result

    # Orbital Strike: 6 to target, 3 to all others
    if "6 damage to an enemy character" in effect_text and "3 damage to all other" in effect_text:
        if target_instance is None:
            result.description = f"{spell.name}: requires a target"
            return result

        # Deal 6 to primary target
        actual_primary = _deal_damage(target_instance, 6)
        result.damage_dealt[target_instance.name] = actual_primary

        # Deal 3 to all others
        for enemy in enemies:
            if enemy.instance_id != target_instance.instance_id and enemy.is_alive:
                actual = _deal_damage(enemy, 3)
                result.damage_dealt[enemy.name] = result.damage_dealt.get(enemy.name, 0) + actual

        result.success = True
        result.description = (
            f"{spell.name} deals {actual_primary} to {target_instance.name}, 3 to others"
        )

    # Ancient Star Map: 2 to all enemies + draw
    elif "2 damage to all enemy characters" in effect_text:
        for enemy in enemies:
            actual = _deal_damage(enemy, 2)
            result.damage_dealt[enemy.name] = actual

        # Also draw a card
        caster = _get_player(game, caster_name)
        if caster:
            drawn = caster.draw_card()
            if drawn:
                result.cards_drawn = {caster_name: 1}
                result.description = f"{spell.name} deals 2 to all enemies, draws 1 card"
            else:
                result.description = f"{spell.name} deals 2 to all enemies"
        else:
            result.description = f"{spell.name} deals 2 to all enemies"

        result.success = True

    return result


def resolve_silence_all(game: Game, caster_name: str, spell: SpellCard) -> EffectResult:
    """
    Silence all enemy characters until end of turn.
    Used by: Media Blackout.
    """
    result = EffectResult(effect_type="silence_all", success=False)
    enemies = _get_enemy_characters(game, caster_name)

    if not enemies:
        result.description = f"{spell.name}: no enemy characters to silence"
        return result

    silenced_names = []
    for enemy in enemies:
        if not enemy.is_silenced:
            apply_silence(enemy)
            # Mark as temporary (until end of turn)
            enemy.silence_turns_remaining = 1
            silenced_names.append(enemy.name)

    result.success = True
    result.silenced = silenced_names
    result.description = f"{spell.name} silences {', '.join(silenced_names)}"

    return result


def resolve_holy_inquisition(
    game: Game, caster_name: str, spell: SpellCard, target_instance: CardInstance | None = None
) -> EffectResult:
    """
    Silence AND deal 3 damage to a single target.
    Used by: Holy Inquisition.
    """
    result = EffectResult(effect_type="silence_damage", success=False)

    if target_instance is None:
        result.description = f"{spell.name}: no target selected"
        return result

    # Silence
    apply_silence(target_instance)
    result.silenced = [target_instance.name]

    # Damage
    actual = _deal_damage(target_instance, 3)
    result.damage_dealt = {target_instance.name: actual}

    result.success = True
    result.description = f"{spell.name} silences {target_instance.name} and deals {actual} damage"

    return result


def resolve_heal(
    game: Game,
    caster_name: str,
    spell: SpellCard,
    target_instance: CardInstance | None = None,
    target_player: Player | None = None,
) -> EffectResult:
    """
    Restore HP to hero (player) or character.
    Used by: Absolution (restore 5 HP. Draw a card).
    """
    result = EffectResult(effect_type="heal", success=False)

    heal_amount = 5  # Absolution restores 5

    if target_instance is not None:
        healed = target_instance.heal(heal_amount)
        result.healing_done = {target_instance.name: healed}
        result.description = f"{spell.name} restores {healed} HP to {target_instance.name}"
    elif target_player is not None:
        old_life = target_player.life
        target_player.life = min(Player.STARTING_LIFE, target_player.life + heal_amount)
        healed = target_player.life - old_life
        result.healing_done = {target_player.name: healed}
        result.description = f"{spell.name} restores {healed} HP to {target_player.name}"
    else:
        result.description = f"{spell.name}: no target"
        return result

    result.success = True

    # Also draw a card
    caster = _get_player(game, caster_name)
    if caster:
        drawn = caster.draw_card()
        if drawn:
            result.cards_drawn = {caster_name: 1}

    return result


def resolve_card_draw_discard(game: Game, caster_name: str, spell: SpellCard) -> EffectResult:
    """
    Draw cards, then each player discards.
    Used by: Black Budget (draw 2, each discards 1).
    """
    result = EffectResult(effect_type="card_draw_discard", success=True)
    caster = _get_player(game, caster_name)

    if not caster:
        return result

    # Draw 2
    drawn_cards = []
    for _ in range(2):
        card = caster.draw_card()
        if card:
            drawn_cards.append(card.name)

    if drawn_cards:
        result.cards_drawn = {caster_name: len(drawn_cards)}

    # Each player discards 1 (random)
    discarded: dict[str, list[str]] = {}
    for p in game.players:
        if p.hand:
            import random

            discard = random.choice(p.hand)
            p.hand.remove(discard)
            discarded[p.name] = [discard.name]

    result.discarded = discarded
    result.description = f"{spell.name}: drew {len(drawn_cards)}, each player discards 1"

    return result


def resolve_debuff_attack(
    game: Game, caster_name: str, spell: SpellCard, target_instance: CardInstance | None = None
) -> EffectResult:
    """
    Give a character negative attack until end of turn.
    Used by: Neural Scramble (-2 ATK).
    """
    result = EffectResult(effect_type="debuff", success=False)

    if target_instance is None:
        result.description = f"{spell.name}: no target"
        return result

    # Parse debuff amount
    match = re.search(r"(-?\d+) Attack", spell.effect)
    delta = int(match.group(1)) if match else -2  # default for Neural Scramble

    target_instance.modify_attack(delta)
    # Mark as temp buff (cleared at end of turn)
    target_instance.buffs.append(f"effect:{delta}_atk")

    result.success = True
    result.debuffs_applied = {target_instance.name: delta}
    result.description = f"{spell.name} gives {target_instance.name} {delta} Attack"

    return result


def resolve_mind_control(
    game: Game,
    caster_name: str,
    spell: SpellCard,
    target_instance: CardInstance | None = None,
    atk_threshold: int = 3,
    buff_atk: int = 2,
) -> EffectResult:
    """
    Take control of an enemy character, optionally buffed.
    Used by: Manchurian Protocol (steal <=3 ATK, +2 ATK).
    """
    result = EffectResult(effect_type="mind_control", success=False)

    if target_instance is None:
        result.description = f"{spell.name}: no target"
        return result

    # Find the enemy player who owns the target
    enemy_player = None
    target_idx = None
    for p in game.players:
        for i, c in enumerate(p.board):
            if c.instance_id == target_instance.instance_id:
                enemy_player = p
                target_idx = i
                break
        if enemy_player:
            break

    if enemy_player is None or target_idx is None:
        result.description = f"{spell.name}: target not found on board"
        return result

    # Check ATK threshold
    if target_instance.current_attack > atk_threshold:
        result.description = (
            f"{spell.name}: target ATK {target_instance.current_attack} > {atk_threshold}"
        )
        return result

    # Remove from enemy board
    stolen = enemy_player.board.pop(target_idx)

    # Buff if specified
    if buff_atk:
        stolen.modify_attack(buff_atk)
        stolen.buffs.append(f"+{buff_atk}_atk_stolen")

    # Set owner and add to caster's board
    caster = _get_player(game, caster_name)
    if caster is None:
        result.description = f"{spell.name}: caster not found"
        return result

    stolen.owner = caster_name
    caster.board.append(stolen)

    result.success = True
    result.stolen = [stolen.name]
    result.description = f"{spell.name} takes control of {stolen.name}"

    return result


def resolve_spray_damage(
    game: Game,
    caster_name: str,
    spell: SpellCard,
    target_instance: CardInstance | None = None,
    primary_dmg: int = 6,
    splash_dmg: int = 3,
) -> EffectResult:
    """
    Deal primary damage to target + splash to all other enemies.
    Used by: Orbital Strike.
    """
    result = EffectResult(effect_type="spray_damage", success=False)

    if target_instance is None:
        result.description = f"{spell.name}: no target"
        return result

    enemies = _get_enemy_characters(game, caster_name)

    # Primary damage
    actual_primary = _deal_damage(target_instance, primary_dmg)
    result.damage_dealt = {target_instance.name: actual_primary}

    # Splash to others
    for enemy in enemies:
        if enemy.instance_id != target_instance.instance_id:
            actual = _deal_damage(enemy, splash_dmg)
            if actual > 0:
                result.damage_dealt[enemy.name] = result.damage_dealt.get(enemy.name, 0) + actual

    result.success = True
    result.description = (
        f"{spell.name} deals {actual_primary} to {target_instance.name}, "
        f"{splash_dmg} to all other enemies"
    )
    return result


# ---------------------------------------------------------------------------
# Dispatcher: parse card and resolve its spell effects
# ---------------------------------------------------------------------------


def resolve_spell_effect(
    game: Game,
    caster_name: str,
    spell: Card,
    target_instance: CardInstance | None = None,
    target_player: Player | None = None,
) -> EffectResult:
    """
    Main dispatch function for spell cards. Parses the card's effect text
    and routes to the appropriate handler.
    """
    effect_text = spell.effect.lower()

    # Mind control / steal
    if "take control" in effect_text:
        atk_threshold = 3
        buff = 2
        if "2 or less" in effect_text:
            atk_threshold = 2
            buff = 0
        match = re.search(r"(\d+) or less", effect_text)
        if match:
            atk_threshold = int(match.group(1))
        return resolve_mind_control(game, caster_name, spell, target_instance, atk_threshold, buff)

    # Silence + damage (Holy Inquisition)
    if "silence and deal" in effect_text:
        return resolve_holy_inquisition(game, caster_name, spell, target_instance)

    # Silence all
    if "silence all" in effect_text:
        return resolve_silence_all(game, caster_name, spell)

    # Damage all enemies (AOE)
    if "all enemy characters" in effect_text and "deal" in effect_text:
        # Orbital Strike: 6 to target + 3 to others
        if "6 damage" in effect_text or "3 damage to all other" in effect_text:
            return resolve_spray_damage(game, caster_name, spell, target_instance)
        # Ancient Star Map: 2 to all
        if "2 damage" in effect_text:
            return resolve_damage_all_enemies(game, caster_name, spell)

    # Spray damage (Orbital Strike)
    if "damage to an enemy character" in effect_text and "all other" in effect_text:
        return resolve_spray_damage(game, caster_name, spell, target_instance)

    # Heal
    if "restore" in effect_text and "health" in effect_text:
        return resolve_heal(game, caster_name, spell, target_instance, target_player)

    # Card draw + discard
    if "draw" in effect_text and "discard" in effect_text:
        return resolve_card_draw_discard(game, caster_name, spell)

    # Attack debuff
    if "attack" in effect_text and ("give" in effect_text or "-" in effect_text):
        return resolve_debuff_attack(game, caster_name, spell, target_instance)

    # Single target damage (Divine Smite and similar)
    match = re.search(r"deal (\d+) damage to (?:a |an )?target character", effect_text)
    if match:
        return resolve_spell_damage(game, caster_name, spell, target_instance)

    # Fallback: effect parsed but no handler
    return EffectResult(
        effect_type="unhandled",
        success=False,
        description=f"{spell.name}: effect not implemented for '{spell.effect}'",
    )


# ---------------------------------------------------------------------------
# Character ability triggers
# ---------------------------------------------------------------------------


def resolve_on_play_ability(game: Game, caster_name: str, character: CardInstance) -> EffectResult:
    """
    Resolve a character's on-play ability.
    Called immediately after the character is placed on the board.
    """
    ability = character.card.ability if hasattr(character.card, "ability") else ""
    ability_lower = ability.lower()
    result = EffectResult(effect_type="on_play", success=False)

    # --- Shadow Broker: look at opponent's hand and discard one ---
    if "look at opponent" in ability_lower and "discard" in ability_lower:
        opponent = None
        for p in game.players:
            if p.name != caster_name:
                opponent = p
                break
        if opponent and opponent.hand:
            import random

            discarded = random.choice(opponent.hand)
            opponent.hand.remove(discarded)
            result.discarded = {opponent.name: [discarded.name]}
            result.description = (
                f"{character.name} forces {opponent.name} to discard {discarded.name}"
            )
            result.success = True
        else:
            result.description = f"{character.name}: opponent has no cards to discard"
        return result

    # --- Psionic Dominator / Abduction Specialist: control or bounce ---
    if "take control" in ability_lower:
        match = re.search(r"(\d+) or less Attack", ability)
        threshold = int(match.group(1)) if match else 2
        enemies = _get_enemy_characters(game, caster_name)
        valid_targets = [e for e in enemies if e.current_attack <= threshold]
        if valid_targets:
            target = valid_targets[0]  # pick first valid target for now
            # Steal
            for p in game.players:
                for i, c in enumerate(p.board):
                    if c.instance_id == target.instance_id:
                        stolen = p.board.pop(i)
                        stolen.owner = caster_name
                        caster = _get_player(game, caster_name)
                        if caster:
                            caster.board.append(stolen)
                        result.stolen = [stolen.name]
                        result.description = f"{character.name} steals {stolen.name}"
                        result.success = True
                        return result
        result.description = f"{character.name}: no valid target"
        return result

    if "return" in ability_lower and "hand" in ability_lower:
        match = re.search(r"(\d+) or less Attack", ability)
        threshold = int(match.group(1)) if match else 3
        enemies = _get_enemy_characters(game, caster_name)
        valid_targets = [e for e in enemies if e.current_attack <= threshold]
        if valid_targets:
            target = valid_targets[0]
            for p in game.players:
                for i, c in enumerate(p.board):
                    if c.instance_id == target.instance_id:
                        bounced = p.board.pop(i)
                        bounced.damage_taken = 0  # reset damage when bounced
                        bounced.is_exhausted = True
                        p.hand.append(bounced.card)
                        result.bounced = [bounced.name]
                        result.description = f"{character.name} bounces {bounced.name} to hand"
                        result.success = True
                        return result
        result.description = f"{character.name}: no valid bounce target"
        return result

    # No activated on-play ability
    result.description = f"{character.name}: no activatable on-play effect"
    return result


# ---------------------------------------------------------------------------
# Location ongoing effects
# ---------------------------------------------------------------------------


def resolve_start_of_turn_locations(game: Game, player: Player) -> list[EffectResult]:
    """
    Resolve location effects that trigger at start of turn.
    Checks both the player's location and applies aura effects.
    """
    results: list[EffectResult] = []

    if player.location is None:
        return results

    effect_text = player.location.card.effect.lower()
    loc_name = player.location.card.name

    # Sacred Chapel: heal 1 from all characters
    if "heal 1" in effect_text or "restore 1" in effect_text:
        for char in player.board:
            if char.damage_taken > 0:
                healed = char.heal(1)
                if healed > 0:
                    pass  # silently healed

        results.append(
            EffectResult(
                effect_type="location_heal",
                success=True,
                description=f"{loc_name}: healed 1 damage from all characters",
                healing_done={c.name: 1 for c in player.board if c.is_alive},
            )
        )

    # Holy Grail Sanctum: if damaged char exists, restore 2 HP to it
    if "if you have a damaged character" in effect_text:
        damaged = [c for c in player.board if c.damage_taken > 0]
        if damaged:
            target = damaged[0]  # target first damaged char
            healed = target.heal(2)
            results.append(
                EffectResult(
                    effect_type="location_heal",
                    success=True,
                    description=f"{loc_name}: restores {healed} HP to {target.name}",
                    healing_done={target.name: healed},
                )
            )

    return results


def resolve_end_of_turn_locations(game: Game, player: Player) -> list[EffectResult]:
    """
    Resolve location effects that trigger at end of turn.
    """
    results: list[EffectResult] = []

    if player.location is None:
        return results

    effect_text = player.location.card.effect.lower()
    loc_name = player.location.card.name

    # Bilderberg Estate: if you control more chars than opponent, draw
    if "control more characters" in effect_text:
        opponent = None
        for p in game.players:
            if p.name != player.name:
                opponent = p
                break
        if opponent is not None and len(player.board) > len(opponent.board):
            drawn = player.draw_card()
            if drawn:
                results.append(
                    EffectResult(
                        effect_type="location_draw",
                        success=True,
                        description=f"{loc_name}: drew a card (board advantage)",
                        cards_drawn={player.name: 1},
                    )
                )

    return results


def resolve_aura_effects(game: Game, player: Player) -> list[EffectResult]:
    """
    Resolve persistent aura effects from locations.
    These are applied continuously while the location is active.
    """
    results: list[EffectResult] = []

    if player.location is None:
        return results

    effect_text = player.location.card.effect.lower()
    loc_name = player.location.card.name

    # Secret Society Lodge: all Illuminati chars gain +1 ATK
    if "+1 attack" in effect_text:
        for char in player.board:
            # Only apply if not already buffed by this effect
            if "lodge_atk" not in char.buffs:
                char.modify_attack(1)
                char.buffs.append("lodge_atk")
                results.append(
                    EffectResult(
                        effect_type="location_aura",
                        success=True,
                        description=f"{loc_name}: {char.name} gains +1 ATK",
                    )
                )

    # Underground Ant Colony: Reptilian chars gain +1 ATK
    if "gain +1 attack" in effect_text and "when one of your characters dies" not in effect_text:
        for char in player.board:
            if "colony_atk" not in char.buffs:
                char.modify_attack(1)
                char.buffs.append("colony_atk")

    # Knight Commander aura: other Templar chars gain +1 HP
    # This is handled as a character aura; check each board creature
    for char in player.board:
        ability = char.card.ability.lower() if hasattr(char.card, "ability") else ""
        if "other templar" in ability and "health" in ability:
            for ally in player.board:
                if ally.instance_id != char.instance_id and "kc_hp" not in ally.buffs:
                    ally.modify_health(1)
                    ally.buffs.append("kc_hp")

    return results
