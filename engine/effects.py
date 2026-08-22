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
    return target.take_damage(amount)


def effect_requires_board_target(text: str) -> bool:
    """True if this text cannot legally resolve without a chosen character."""
    lower = (text or "").lower()
    if not lower.strip():
        return False
    if "split:" in lower or "discover" in lower:
        return False
    if "all enemy characters" in lower and "all other" not in lower:
        return False
    if "all your characters" in lower or "all friendly" in lower:
        return False
    return bool(
        re.search(
            r"(a |an )?(target|enemy|friendly) character|give an enemy|return an enemy|"
            r"take control of an enemy|silence and deal",
            lower,
        )
    )


def parse_split_options(text: str) -> list[str]:
    """Parse 'Split: A. | B.' into the two option strings."""
    match = re.search(r"split:\s*(.+)", text, flags=re.IGNORECASE)
    if not match:
        return []
    return [part.strip() for part in match.group(1).split("|") if part.strip()]


def _draw_for(game: "Game", player: Player):
    """Draw through Game._draw when available so Flash/Manifest can fire."""
    drawer = getattr(game, "_draw", None)
    if callable(drawer):
        return drawer(player)
    return player.draw_card()


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


def _player_faction(player: Player | None) -> str:
    """Starting identity for conditional Network effects."""
    if player is None:
        return ""
    return getattr(player, "faction", "") or ""


def _if_you_are_faction(text: str) -> str | None:
    """Return the faction named in 'If you are X', or None if unconditional."""
    match = re.search(r"if you are (illuminati|templars|reptilians)", text.lower())
    if not match:
        return None
    return match.group(1)


def _condition_met(text: str, faction: str) -> bool:
    """True if text has no faction gate, or the player's faction matches it."""
    required = _if_you_are_faction(text)
    return required is None or required == faction


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
    caster = _get_player(game, caster_name)
    if caster:
        damage += sum(getattr(c, "amplify", 0) for c in caster.board if not c.is_silenced)

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
    effect_lower = effect_text.lower()

    enemies = _get_enemy_characters(game, caster_name)
    if not enemies:
        result.success = True
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

    # Deal N to all enemies (Consecration 1, Star Map 2, Hive Signal 3, …)
    aoe = re.search(r"deal (\d+) damage to all enemy characters", effect_lower)
    if aoe:
        amount = int(aoe.group(1))
        for enemy in enemies:
            actual = _deal_damage(enemy, amount)
            result.damage_dealt[enemy.name] = actual

        caster = _get_player(game, caster_name)
        if caster and "draw" in effect_lower:
            drawn = _draw_for(game, caster)
            if drawn:
                result.cards_drawn = {caster_name: 1}

        result.success = True
        result.description = f"{spell.name} deals {amount} to all enemies"
        return result

    return result


def resolve_silence_all(game: Game, caster_name: str, spell: SpellCard) -> EffectResult:
    """
    Silence all enemy characters until end of turn.
    Used by: Media Blackout.
    """
    result = EffectResult(effect_type="silence_all", success=False)
    enemies = _get_enemy_characters(game, caster_name)

    if not enemies:
        result.success = True
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

    amount_match = re.search(r"restore (\d+) health", spell.effect.lower())
    heal_amount = int(amount_match.group(1)) if amount_match else 5

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
        drawn = _draw_for(game, caster)
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
        card = _draw_for(game, caster)
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
        result = resolve_damage_all_enemies(game, caster_name, spell)
        caster = _get_player(game, caster_name)
        if caster and "gain +1 attack" in effect_text:
            for ally in _get_own_characters(game, caster_name):
                ally.modify_attack(1)
                ally.buffs.append("hive_atk")
        if caster and "restore" in effect_text and "friendly" in effect_text:
            heal_n = re.search(r"restore (\d+) health", effect_text)
            amount = int(heal_n.group(1)) if heal_n else 2
            for ally in _get_own_characters(game, caster_name):
                ally.heal(amount)
        return result

    # Spray damage (Orbital Strike)
    if "damage to an enemy character" in effect_text and "all other" in effect_text:
        return resolve_spray_damage(game, caster_name, spell, target_instance)

    # Destroy a friendly character (Martyr's Blessing)
    if "destroy a friendly character" in effect_text:
        result = EffectResult(effect_type="destroy_friendly", success=False)
        if target_instance is None:
            result.description = f"{spell.name}: no friendly target"
            return result
        target_instance.damage_taken = target_instance._base_health + target_instance.health_bonus
        result.success = True
        result.destroyed = [target_instance.name]
        caster = _get_player(game, caster_name)
        drawn = 0
        if caster and "draw" in effect_text:
            count_match = re.search(r"draw (\d+)", effect_text)
            for _ in range(int(count_match.group(1)) if count_match else 1):
                if _draw_for(game, caster):
                    drawn += 1
            result.cards_drawn = {caster_name: drawn}
        if caster:
            heal_match = re.search(r"restore (\d+) health to your hero", effect_text)
            if heal_match:
                amount = int(heal_match.group(1))
                old = caster.life
                caster.life = min(Player.STARTING_LIFE, caster.life + amount)
                result.healing_done = {caster.name: caster.life - old}
        result.description = f"{spell.name} destroys {target_instance.name}"
        return result

    # Bounce an enemy character
    if "return an enemy character" in effect_text and "hand" in effect_text:
        result = EffectResult(effect_type="bounce", success=False)
        match = re.search(r"(\d+) or less", effect_text)
        threshold = int(match.group(1)) if match else 3
        target = target_instance
        if target is None:
            valid = [e for e in _get_enemy_characters(game, caster_name) if e.current_attack <= threshold]
            target = valid[0] if valid else None
        if target is None or target.current_attack > threshold:
            result.description = f"{spell.name}: no valid bounce target"
            return result
        for p in game.players:
            for i, c in enumerate(p.board):
                if c.instance_id == target.instance_id:
                    bounced = p.board.pop(i)
                    bounced.damage_taken = 0
                    p.hand.append(bounced.card)
                    result.success = True
                    result.bounced = [bounced.name]
                    result.description = f"{spell.name} returns {bounced.name} to hand"
                    return result
        result.description = f"{spell.name}: target not found"
        return result

    # Heal (skip if this is a damage spell with a heal rider)
    if "restore" in effect_text and "health" in effect_text and "deal" not in effect_text:
        if target_instance is None and target_player is None:
            target_player = _get_player(game, caster_name)
        return resolve_heal(game, caster_name, spell, target_instance, target_player)

    # Opponent discards N (optionally you draw)
    if "opponent discards" in effect_text:
        result = EffectResult(effect_type="discard", success=True)
        count_match = re.search(r"opponent discards (\d+)", effect_text)
        n = int(count_match.group(1)) if count_match else 1
        opponent = next((p for p in game.players if p.name != caster_name), None)
        dumped: list[str] = []
        if opponent:
            import random

            for _ in range(n):
                if not opponent.hand:
                    break
                card = random.choice(opponent.hand)
                opponent.hand.remove(card)
                dumped.append(card.name)
        if dumped:
            result.discarded = {opponent.name: dumped}
        caster = _get_player(game, caster_name)
        if caster and "draw" in effect_text:
            draw_n = re.search(r"draw (\d+)", effect_text)
            drawn = 0
            for _ in range(int(draw_n.group(1)) if draw_n else 1):
                if _draw_for(game, caster):
                    drawn += 1
            result.cards_drawn = {caster_name: drawn}
        result.description = f"{spell.name}: discarded {len(dumped)}"
        return result

    # Card draw + discard
    if "draw" in effect_text and "discard" in effect_text:
        return resolve_card_draw_discard(game, caster_name, spell)

    # Give a friendly Shielding
    if "shielding" in effect_text and "friendly" in effect_text:
        result = EffectResult(effect_type="grant_shield", success=False)
        if target_instance is None:
            result.description = f"{spell.name}: no friendly target"
            return result
        target_instance.has_shield = True
        result.success = True
        result.buffs_applied = [target_instance.name]
        result.description = f"{spell.name} gives {target_instance.name} Shielding"
        return result

    # Give a friendly Stealth
    if "stealth" in effect_text and "friendly" in effect_text:
        result = EffectResult(effect_type="grant_stealth", success=False)
        if target_instance is None:
            result.description = f"{spell.name}: no friendly target"
            return result
        target_instance.is_stealth = True
        result.success = True
        result.description = f"{spell.name} gives {target_instance.name} Stealth"
        return result

    # Summon N tokens
    if "summon" in effect_text and "raptor" in effect_text:
        caster = _get_player(game, caster_name)
        result = EffectResult(effect_type="summon", success=False)
        if not caster:
            result.description = f"{spell.name}: no caster"
            return result
        count_match = re.search(r"summon (\w+) 2/1 raptor", effect_text)
        n = 2 if "two" in effect_text else 1
        summoned = 0
        for _ in range(n):
            inst = summon_token(game, caster, name="Raptor", attack=2, health=1)
            if inst:
                summoned += 1
        result.success = summoned > 0
        result.description = f"{spell.name} summons {summoned} Raptor"
        return result

    # Your characters can attack (Rush) this turn
    if "rush this turn" in effect_text or "gain rush this turn" in effect_text:
        result = EffectResult(effect_type="mass_rush", success=True)
        for ally in _get_own_characters(game, caster_name):
            ally.is_exhausted = False
            ally.rush_locked = True
            result.buffs_applied.append(ally.name)
        result.description = f"{spell.name}: your characters have Rush this turn"
        return result

    # Mass / single buffs for friendly characters
    mass_stats = re.search(r"give all your characters \+(\d+)/\+(\d+)", effect_text)
    if mass_stats:
        result = EffectResult(effect_type="mass_buff", success=True)
        for ally in _get_own_characters(game, caster_name):
            ally.modify_attack(int(mass_stats.group(1)))
            ally.modify_health(int(mass_stats.group(2)))
            ally.buffs.append("mass_buff")
            result.buffs_applied.append(ally.name)
        result.description = f"{spell.name}: +{mass_stats.group(1)}/+{mass_stats.group(2)} to your characters"
        return result
    mass_hp = re.search(r"give all your characters \+(\d+) health", effect_text)
    if mass_hp:
        result = EffectResult(effect_type="mass_buff", success=True)
        for ally in _get_own_characters(game, caster_name):
            ally.modify_health(int(mass_hp.group(1)))
            ally.buffs.append("mass_hp")
            result.buffs_applied.append(ally.name)
        result.description = f"{spell.name}: +{mass_hp.group(1)} Health to your characters"
        return result
    if "gain taunt" in effect_text:
        result = EffectResult(effect_type="mass_taunt", success=True)
        for ally in _get_own_characters(game, caster_name):
            ally.has_taunt = True
            result.buffs_applied.append(ally.name)
        caster = _get_player(game, caster_name)
        if caster:
            heal_match = re.search(r"restore (\d+) health to your hero", effect_text)
            if heal_match:
                amount = int(heal_match.group(1))
                old = caster.life
                caster.life = min(Player.STARTING_LIFE, caster.life + amount)
                result.healing_done = {caster.name: caster.life - old}
        result.description = f"{spell.name}: your characters gain Taunt"
        return result
    friendly_atk = re.search(r"give a friendly character \+(\d+) attack", effect_text)
    if friendly_atk:
        result = EffectResult(effect_type="buff", success=False)
        if target_instance is None:
            result.description = f"{spell.name}: no friendly target"
            return result
        target_instance.modify_attack(int(friendly_atk.group(1)))
        target_instance.buffs.append(f"+{friendly_atk.group(1)}_atk")
        result.success = True
        result.buffs_applied = [target_instance.name]
        result.description = f"{spell.name} gives {target_instance.name} +{friendly_atk.group(1)} Attack"
        return result

    # Attack debuff
    if "attack" in effect_text and ("give" in effect_text or "-" in effect_text):
        result = resolve_debuff_attack(game, caster_name, spell, target_instance)
        if result.success and "draw" in effect_text:
            caster = _get_player(game, caster_name)
            if caster and _draw_for(game, caster):
                result.cards_drawn = {caster_name: 1}
        return result

    # Single target damage (Divine Smite, Judgment, Burn Notice, …)
    match = re.search(
        r"deal (\d+) damage to (?:a |an )?(?:target |enemy )?character",
        effect_text,
    )
    if match and "all enemy" not in effect_text:
        result = resolve_spell_damage(game, caster_name, spell, target_instance)
        caster = _get_player(game, caster_name)
        heal_match = re.search(r"restore (\d+) health to your hero", effect_text)
        if result.success and heal_match and caster:
            if "if you are templars" not in effect_text or _player_faction(caster) == "templars":
                amount = int(heal_match.group(1))
                old = caster.life
                caster.life = min(Player.STARTING_LIFE, caster.life + amount)
                healed = caster.life - old
                result.healing_done = {caster.name: healed}
                result.description += f" and restores {healed} HP"
        if result.success and "if it dies" in effect_text and "draw" in effect_text and caster:
            if target_instance is not None and not target_instance.is_alive:
                if _draw_for(game, caster):
                    result.cards_drawn = {caster_name: 1}
                    result.description += " and draws"
        return result

    # Silence two (or one) enemy characters
    if "silence two" in effect_text or (
        "silence" in effect_text and "enemy character" in effect_text and "all" not in effect_text
        and "deal" not in effect_text
    ):
        result = EffectResult(effect_type="silence", success=False)
        enemies = [e for e in _get_enemy_characters(game, caster_name) if not e.is_silenced]
        chosen: list[CardInstance] = []
        if target_instance is not None:
            chosen.append(target_instance)
        for enemy in enemies:
            if enemy not in chosen:
                chosen.append(enemy)
            if "silence two" in effect_text and len(chosen) >= 2:
                break
            if "silence two" not in effect_text and len(chosen) >= 1:
                break
        if not chosen:
            result.description = f"{spell.name}: no target selected"
            return result
        for enemy in chosen:
            apply_silence(enemy)
        result.success = True
        result.silenced = [c.name for c in chosen]
        result.description = f"{spell.name} silences {', '.join(result.silenced)}"
        if "draw" in effect_text:
            caster = _get_player(game, caster_name)
            if caster and _draw_for(game, caster):
                result.cards_drawn = {caster_name: 1}
        return result

    # Silence a single target
    if "silence" in effect_text and "target" in effect_text:
        result = EffectResult(effect_type="silence", success=False)
        if target_instance is None:
            result.description = f"{spell.name}: no target selected"
            return result
        apply_silence(target_instance)
        result.success = True
        result.silenced = [target_instance.name]
        result.description = f"{spell.name} silences {target_instance.name}"
        return result

    # They attack each other (leave the rest to draw if printed)
    if "attack each other" in effect_text:
        result = EffectResult(effect_type="brawl", success=False)
        enemies = [e for e in _get_enemy_characters(game, caster_name) if e.is_alive]
        if len(enemies) < 2:
            result.description = f"{spell.name}: not enough enemies"
        else:
            for attacker in list(enemies):
                for defender in enemies:
                    if attacker.instance_id != defender.instance_id and defender.is_alive:
                        defender.take_damage(attacker.current_attack)
            result.success = True
            result.description = f"{spell.name}: enemies attack each other"
        if "draw" in effect_text:
            caster = _get_player(game, caster_name)
            count_match = re.search(r"draw (\d+)", effect_text)
            drawn = 0
            if caster:
                for _ in range(int(count_match.group(1)) if count_match else 1):
                    if _draw_for(game, caster):
                        drawn += 1
                result.cards_drawn = {caster_name: drawn}
                result.success = True
        return result

    # Discover a card
    if "discover" in effect_text:
        caster = _get_player(game, caster_name)
        result = EffectResult(effect_type="discovery", success=False)
        if not caster:
            result.description = f"{spell.name}: no caster"
            return result
        options = collect_discovery_options(caster)
        game.pending_discovery = {
            "player": caster.name,
            "cards": options,
        }
        result.success = True
        result.description = f"{spell.name}: Discover a card"
        result.extra = {"options": [c.name for c in options]}
        return result

    # Draw N cards (no discard rider)
    if "draw" in effect_text and "discard" not in effect_text:
        caster = _get_player(game, caster_name)
        result = EffectResult(effect_type="draw", success=False)
        if not caster:
            result.description = f"{spell.name}: no caster"
            return result
        count_match = re.search(r"draw (\d+) cards?", effect_text)
        count = int(count_match.group(1)) if count_match else 1
        drawn = 0
        for _ in range(count):
            if _draw_for(game, caster):
                drawn += 1
        result.success = drawn > 0
        result.cards_drawn = {caster_name: drawn}
        result.description = f"{spell.name}: drew {drawn}"
        return result

    # Stasis a target character
    if "stasis" in effect_text:
        result = EffectResult(effect_type="stasis", success=False)
        if target_instance is None:
            result.description = f"{spell.name}: no target selected"
            return result
        target_instance.stasis = True
        target_instance.is_exhausted = True
        result.success = True
        result.description = f"{spell.name} puts {target_instance.name} in Stasis"
        return result

    # Hero Ward until end of turn
    if "ward" in effect_text and "hero" in effect_text:
        caster = _get_player(game, caster_name)
        result = EffectResult(effect_type="ward", success=False)
        if not caster:
            result.description = f"{spell.name}: no caster"
            return result
        caster.has_ward = True
        result.success = True
        result.description = f"{spell.name}: {caster.name} has Ward"
        return result

    # Direct damage to the enemy hero
    face = re.search(r"deal (\d+) damage to the enemy hero", effect_text)
    if face:
        caster = _get_player(game, caster_name)
        opponent = next((p for p in game.players if p.name != caster_name), None)
        result = EffectResult(effect_type="hero_damage", success=False)
        if opponent is None:
            result.description = f"{spell.name}: no opponent"
            return result
        bonus = 0
        if caster:
            bonus = sum(getattr(c, "amplify", 0) for c in caster.board if not c.is_silenced)
        dealt = opponent.direct_damage(int(face.group(1)) + bonus)
        result.success = True
        result.damage_dealt = {opponent.name: dealt}
        result.description = f"{spell.name} deals {dealt} to {opponent.name}"
        return result

    # Look at hand and bump a card's cost (Wiretap)
    if "look at opponent" in effect_text and "cost" in effect_text:
        opponent = next((p for p in game.players if p.name != caster_name), None)
        result = EffectResult(effect_type="wiretap", success=True)
        if opponent and opponent.hand:
            import random

            chosen = random.choice(opponent.hand)
            bump = 2
            cost_match = re.search(r"\+(\d+) cost", effect_text)
            if cost_match:
                bump = int(cost_match.group(1))
            opponent.hand_cost_bonus[id(chosen)] = (
                opponent.hand_cost_bonus.get(id(chosen), 0) + bump
            )
            result.description = f"{spell.name}: {chosen.name} costs +{bump} this turn"
        else:
            result.description = f"{spell.name}: opponent hand empty"
        if "draw" in effect_text:
            caster = _get_player(game, caster_name)
            if caster and _draw_for(game, caster):
                result.cards_drawn = {caster_name: 1}
        return result

    # Fallback: effect parsed but no handler
    return EffectResult(
        effect_type="unhandled",
        success=False,
        description=f"{spell.name}: effect not implemented for '{spell.effect}'",
    )


# ---------------------------------------------------------------------------
# Character ability triggers
# ---------------------------------------------------------------------------


def resolve_on_play_ability(
    game: Game,
    caster_name: str,
    character: CardInstance,
    target_instance: CardInstance | None = None,
) -> EffectResult:
    """
    Resolve Assault / when-played. Only call this when the character
    was played from hand.
    """
    ability = character.card.ability if hasattr(character.card, "ability") else ""
    ability_lower = ability.lower()
    result = EffectResult(effect_type="assault", success=False)

    # Assault: Deal N damage to a target character
    dmg = re.search(
        r"(?:assault:\s*)?deal (\d+) damage to (?:a |an )?(?:target character|target|enemy character)",
        ability_lower,
    )
    if dmg and ("assault:" in ability_lower or "when played" in ability_lower):
        if target_instance is None:
            result.description = f"{character.name}: Assault needs a target"
            return result
        actual = _deal_damage(target_instance, int(dmg.group(1)))
        result.success = True
        result.damage_dealt = {target_instance.name: actual}
        result.description = f"{character.name} Assault deals {actual} to {target_instance.name}"
        return result

    # Assault: Restore N Health to a target character
    heal = re.search(
        r"(?:assault:\s*)?restore (\d+) health to (?:a |an )?target",
        ability_lower,
    )
    if heal and ("assault:" in ability_lower or "when played" in ability_lower):
        if target_instance is None:
            result.description = f"{character.name}: Assault needs a target"
            return result
        healed = target_instance.heal(int(heal.group(1)))
        result.success = True
        result.healing_done = {target_instance.name: healed}
        result.description = f"{character.name} Assault restores {healed} to {target_instance.name}"
        return result

    # Assault: Give a target +A/+H
    buff = re.search(r"give (?:a |an )?target[^.]*\+(\d+)/\+(\d+)", ability_lower)
    if buff and ("assault:" in ability_lower or "when played" in ability_lower):
        if target_instance is None:
            result.description = f"{character.name}: Assault needs a target"
            return result
        target_instance.modify_attack(int(buff.group(1)))
        target_instance.modify_health(int(buff.group(2)))
        result.success = True
        result.buffs_applied = [target_instance.name]
        result.description = (
            f"{character.name} Assault gives {target_instance.name} "
            f"+{buff.group(1)}/+{buff.group(2)}"
        )
        return result

    # Assault: Give a target -N Attack
    debuff = re.search(r"give (?:a |an )?target[^.]*-(\d+) attack", ability_lower)
    if debuff and ("assault:" in ability_lower or "when played" in ability_lower):
        if target_instance is None:
            result.description = f"{character.name}: Assault needs a target"
            return result
        target_instance.modify_attack(-int(debuff.group(1)))
        result.success = True
        result.description = (
            f"{character.name} Assault gives {target_instance.name} -{debuff.group(1)} Attack"
        )
        return result

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
        if target_instance is not None and target_instance in valid_targets:
            target = target_instance
        elif valid_targets:
            target = valid_targets[0]
        else:
            target = None
        if target:
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

    # --- When played: gain +A/+H (Mimic) ---
    self_buff = re.search(r"when played,\s*gain \+(\d+)/\+(\d+)", ability_lower)
    if self_buff:
        character.modify_attack(int(self_buff.group(1)))
        character.modify_health(int(self_buff.group(2)))
        result.success = True
        result.buffs_applied = [character.name]
        result.description = f"{character.name} gains +{self_buff.group(1)}/+{self_buff.group(2)}"
        return result

    if "when played" in ability_lower and "silence all" in ability_lower:
        silenced = []
        for enemy in _get_enemy_characters(game, caster_name):
            if not enemy.is_silenced:
                apply_silence(enemy)
                enemy.silence_turns_remaining = 1
                silenced.append(enemy.name)
        result.success = True
        result.silenced = silenced
        result.description = f"{character.name} silences {', '.join(silenced) or 'nobody'}"
        return result

    # --- When played: deal N to all enemies ---
    aoe = re.search(r"when played,\s*deal (\d+) damage to all enemy characters", ability_lower)
    if aoe:
        amount = int(aoe.group(1))
        for enemy in _get_enemy_characters(game, caster_name):
            actual = _deal_damage(enemy, amount)
            result.damage_dealt[enemy.name] = actual
        result.success = True
        result.description = f"{character.name} deals {amount} to all enemies"
        if "gains stealth" in ability_lower or "gain stealth" in ability_lower:
            for ally in _get_own_characters(game, caster_name):
                ally.is_stealth = True
        return result

    # --- Inside Man: force a discard ---
    if "when played" in ability_lower and "discard" in ability_lower and "look at" not in ability_lower:
        opponent = next((p for p in game.players if p.name != caster_name), None)
        if opponent and opponent.hand:
            import random

            discarded = random.choice(opponent.hand)
            opponent.hand.remove(discarded)
            result.success = True
            result.discarded = {opponent.name: [discarded.name]}
            result.description = f"{character.name} forces a discard"
            return result

    # --- Network / generic: draw, optional extra if you are Illuminati ---
    if "when played" in ability_lower and "draw" in ability_lower:
        caster = _get_player(game, caster_name)
        if caster:
            drawn = 0
            if _draw_for(game, caster):
                drawn += 1
            if "draw an extra card" in ability_lower and _player_faction(caster) == "illuminati":
                if _draw_for(game, caster):
                    drawn += 1
            result.success = drawn > 0
            result.cards_drawn = {caster_name: drawn}
            result.description = f"{character.name}: drew {drawn}"
        else:
            result.description = f"{character.name}: no caster"
        # Fall through so Stealth / heal riders on the same line can also fire.

    # --- If you are Templars, restore N Health to your hero ---
    heal_hero = re.search(r"restore (\d+) health to your hero", ability_lower)
    if heal_hero and _condition_met(ability_lower, _player_faction(_get_player(game, caster_name))):
        caster = _get_player(game, caster_name)
        if caster:
            amount = int(heal_hero.group(1))
            old = caster.life
            caster.life = min(Player.STARTING_LIFE, caster.life + amount)
            healed = caster.life - old
            result.healing_done = {caster.name: healed}
            result.success = True
            extra = f"restores {healed} HP"
            result.description = f"{character.name}: {extra}" if not result.description else f"{result.description}; {extra}"

    # --- If you are Reptilians, this gains Stealth ---
    if "gains stealth" in ability_lower and _condition_met(
        ability_lower, _player_faction(_get_player(game, caster_name))
    ):
        character.is_stealth = True
        result.success = True
        extra = f"{character.name} gains Stealth"
        result.description = extra if not result.description else f"{result.description}; {extra}"
        return result

    if result.success:
        return result

    if "return" in ability_lower and "hand" in ability_lower:
        match = re.search(r"(\d+) or less Attack", ability)
        threshold = int(match.group(1)) if match else 3
        enemies = _get_enemy_characters(game, caster_name)
        valid_targets = [e for e in enemies if e.current_attack <= threshold]
        if target_instance is not None and target_instance in valid_targets:
            target = target_instance
        elif valid_targets:
            target = valid_targets[0]
        else:
            target = None
        if target:
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
    if "heal 1 damage" in effect_text or (
        "restore 1" in effect_text and "character" in effect_text
    ):
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

    if "if opponent has more cards" in effect_text or "if you have fewer cards" in effect_text:
        opponent = next((p for p in game.players if p.name != player.name), None)
        if opponent is not None and len(player.hand) < len(opponent.hand):
            drawn = _draw_for(game, player)
            if drawn:
                results.append(
                    EffectResult(
                        effect_type="location_draw",
                        success=True,
                        description=f"{loc_name}: drew a card (behind on cards)",
                        cards_drawn={player.name: 1},
                    )
                )

    if "restore 1 health to your hero" in effect_text:
        old = player.life
        player.life = min(Player.STARTING_LIFE, player.life + 1)
        healed = player.life - old
        results.append(
            EffectResult(
                effect_type="location_heal",
                success=True,
                description=f"{loc_name}: restores {healed} HP to {player.name}",
                healing_done={player.name: healed},
            )
        )

    if "deal" in effect_text and "enemy hero" in effect_text:
        opponent = next((p for p in game.players if p.name != player.name), None)
        if opponent:
            amount = 2 if (
                _player_faction(player) == "reptilians" and "deal 2 instead" in effect_text
            ) else 1
            opponent.direct_damage(amount)
            results.append(
                EffectResult(
                    effect_type="location_damage",
                    success=True,
                    description=f"{loc_name}: deals {amount} to {opponent.name}",
                    damage_dealt={opponent.name: amount},
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
            drawn = _draw_for(game, player)
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
    if "tokens gain +1 attack" in effect_text or "token characters gain +1 attack" in effect_text:
        from engine.card import is_token_card

        for char in player.board:
            if is_token_card(char.card) and "token_atk" not in char.buffs:
                char.modify_attack(1)
                char.buffs.append("token_atk")
        return results

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


RAPTOR_TOKEN_ID = "neutral_char_008"


def resolve_deathrattle(game: Game, owner_name: str, character: CardInstance) -> EffectResult:
    """Resolve Deathrattle / 'when this character dies' after a character leaves."""
    from engine.card import has_deathrattle_text

    result = EffectResult(effect_type="deathrattle", success=False)
    if character.is_silenced:
        result.description = f"{character.name}: silenced, no Deathrattle"
        return result
    ability = character.card.ability if hasattr(character.card, "ability") else ""
    if not has_deathrattle_text(ability):
        result.description = f"{character.name}: no Deathrattle"
        return result
    text = ability.lower()
    owner = _get_player(game, owner_name)
    opponent = next((p for p in game.players if p.name != owner_name), None)

    summon = re.search(r"summon a (\d+)/(\d+) ([a-z0-9 '-]+)", text)
    if summon and owner:
        inst = summon_token(
            game,
            owner,
            name=summon.group(3).strip(" ."),
            attack=int(summon.group(1)),
            health=int(summon.group(2)),
            charge="with charge" in text,
        )
        if inst:
            result.success = True
            result.description = f"{character.name} Deathrattle summons {inst.name}"
            return result

    face = re.search(r"deal (\d+) damage to the enemy hero", text)
    if face and opponent:
        dealt = opponent.direct_damage(int(face.group(1)))
        result.success = True
        result.damage_dealt = {opponent.name: dealt}
        result.description = f"{character.name} Deathrattle deals {dealt} to {opponent.name}"
        return result

    if "draw a card" in text and owner:
        drawn = _draw_for(game, owner)
        result.success = drawn is not None
        result.cards_drawn = {owner_name: 1 if drawn else 0}
        result.description = f"{character.name} Deathrattle: draw"
        return result

    result.description = f"{character.name}: Deathrattle not implemented"
    return result


def summon_token(
    game: Game,
    player: Player,
    *,
    name: str,
    attack: int,
    health: int,
    charge: bool = False,
    ability: str | None = None,
) -> CardInstance | None:
    """Summon a token character (no Assault)."""
    from engine.card import create_card_instance
    from engine.decks import load_card_lookup
    from engine.models import CharacterCard

    lookup = load_card_lookup()
    card = lookup.get(RAPTOR_TOKEN_ID)
    printed = ability or ("Token. Charge." if charge else "Token.")
    if card is None or name.lower() != "raptor":
        energy = {
            "illuminati": "Influence",
            "templars": "Faith",
            "reptilians": "Psionics",
        }.get(player.faction, "Conspiracy")
        faction = player.faction if player.faction in ("illuminati", "templars", "reptilians") else "neutral"
        if faction == "neutral":
            energy = "Conspiracy"
        card = CharacterCard(
            id=f"{faction}_char_000",
            name=name.title(),
            faction=faction,
            energy_type=energy,
            cost=0,
            lore="A summoned token.",
            attack=attack,
            health=health,
            ability=printed,
        )
    inst = create_card_instance(card, player._generate_instance_id(), player.name)
    if charge:
        inst.has_charge = True
        inst.is_exhausted = False
        inst.rush_locked = False
    if len(player.board) >= player.MAX_BOARD_SIZE:
        return None
    player.board.append(inst)
    return inst


def resolve_free_text(
    game: Game,
    player: Player,
    text: str,
    target_instance: CardInstance | None = None,
) -> EffectResult:
    """Resolve a short effect clause (Split options, Chain, Flash, Opening)."""
    result = EffectResult(effect_type="text", success=False)
    lower = text.lower()
    opponent = next((p for p in game.players if p.name != player.name), None)

    dmg = re.search(r"deal (\d+) damage to (?:a |an )?(?:target character|target)", lower)
    if dmg:
        if target_instance is None:
            result.description = "needs a target"
            return result
        bonus = sum(getattr(c, "amplify", 0) for c in player.board if not c.is_silenced)
        actual = _deal_damage(target_instance, int(dmg.group(1)) + bonus)
        result.success = True
        result.damage_dealt = {target_instance.name: actual}
        result.description = f"deals {actual}"
        return result

    face = re.search(r"deal (\d+) damage to the enemy hero", lower)
    if face and opponent:
        bonus = sum(getattr(c, "amplify", 0) for c in player.board if not c.is_silenced)
        dealt = opponent.direct_damage(int(face.group(1)) + bonus)
        result.success = True
        result.damage_dealt = {opponent.name: dealt}
        result.description = f"deals {dealt} to hero"
        return result

    draw = re.search(r"draw (\d+) cards?", lower)
    if draw or "draw a card" in lower:
        n = int(draw.group(1)) if draw else 1
        drawn = 0
        for _ in range(n):
            if _draw_for(game, player):
                drawn += 1
        result.success = drawn > 0
        result.cards_drawn = {player.name: drawn}
        result.description = f"drew {drawn}"
        return result

    if "stasis" in lower and target_instance is not None:
        target_instance.stasis = True
        result.success = True
        result.description = f"{target_instance.name} is in Stasis"
        return result

    if "ward" in lower and "hero" in lower:
        player.has_ward = True
        result.success = True
        result.description = f"{player.name} has Ward"
        return result

    result.description = "unhandled text"
    return result


def fire_retaliate(game: Game, character: CardInstance) -> EffectResult | None:
    """Once: when this takes damage and survives."""
    if not character.has_retaliate or character.retaliate_used or not character.is_alive:
        return None
    if character.is_silenced:
        return None
    character.retaliate_used = True
    owner = _get_player(game, character.owner)
    opponent = next((p for p in game.players if p.name != character.owner), None)
    if opponent is None:
        return None
    ability = (character.card.ability if hasattr(character.card, "ability") else "").lower()
    amount = 2
    match = re.search(r"retaliate:\s*deal (\d+)", ability)
    if match:
        amount = int(match.group(1))
    dealt = opponent.direct_damage(amount)
    return EffectResult(
        effect_type="retaliate",
        success=True,
        description=f"{character.name} Retaliate deals {dealt}",
        damage_dealt={opponent.name: dealt},
    )


def fire_excess(game: Game, character: CardInstance) -> EffectResult | None:
    """If Excess just proc'd, resolve its extra effect (usually draw)."""
    if "excess_ready" not in character.buffs:
        return None
    character.buffs = [b for b in character.buffs if b != "excess_ready"]
    owner = _get_player(game, character.owner)
    if owner is None:
        return None
    drawn = _draw_for(game, owner)
    return EffectResult(
        effect_type="excess",
        success=drawn is not None,
        description=f"{character.name} Excess: draw",
        cards_drawn={owner.name: 1 if drawn else 0},
    )


def collect_discovery_options(player: Player, count: int = 3) -> list:
    """Three random cards from the player's faction plus the Network."""
    import random

    from engine.card import is_token_card
    from engine.decks import load_card_lookup

    pool = [
        card
        for card in load_card_lookup().values()
        if card.faction.value in (player.faction, "neutral") and not is_token_card(card)
    ]
    if len(pool) <= count:
        return list(pool)
    return random.sample(pool, count)
