"""
Card runtime instance for Conspiracy TCG.

A CardInstance represents a card that has been played onto the board.
It wraps the static Card data model with mutable runtime state — current
health, attack buffs/debuffs, exhaustion, stealth, silence status, etc.

This is the Hearthstone model: Card = CardDefinition (immutable data),
CardInstance = mutable state on the board.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, model_validator

from engine.models import Card, CharacterCard, LocationCard

_KEYWORD = (
    r"(Charge|Rush|Taunt|Stealth|Enraged|Shielding|Drain|Venom|Recur|"
    r"Stasis|Amplify|Recycle|Chain|Echo|Excess|Retaliate|Flash|Manifest|Opening|Ward)"
)
_PREFIX_KEYWORD = re.compile(rf"^{_KEYWORD}(?:\.|:|\s+)")
_SOLO_KEYWORD = re.compile(rf"^{_KEYWORD}\.?$")


class CardInstance(BaseModel):
    """
    A card that has been played to the board (or is in hand/deck).

    Attributes:
        card: The underlying static card definition (immutable).
        instance_id: Unique runtime ID for this specific instance on the board.
        current_health: May differ from base health due to damage/buffs.
        current_attack: May differ from base attack due to debuffs/buffs.
        damage_taken: Accumulated damage; health = base_health - damage_taken.
        is_exhausted: True if the character cannot attack this turn.
        is_stealth: True if the character has Stealth active.
        is_silenced: True if abilities are suppressed.
        silence_turns_remaining: Turns of silence remaining (-1 = permanent).
        attack_bonus: Temporary attack modifier from effects.
        health_bonus: Temporary health modifier from effects.
        buffs: List of active buff strings for display/debugging.
        has_taunt: Computed from card ability text (Taunt keyword).
        has_charge: Computed from card ability text (Charge keyword).
        owner: Name of the player who controls this instance.
    """

    card: Card
    instance_id: str = Field(..., description="Unique runtime instance ID")
    owner: str = Field(default="", description="Player name who controls this card")

    # Mutable combat state
    damage_taken: int = Field(default=0, ge=0)
    is_exhausted: bool = Field(default=True)  # new cards enter exhausted
    is_stealth: bool = Field(default=False)
    is_silenced: bool = Field(default=False)
    silence_turns_remaining: int = Field(default=0, ge=-1)
    attack_bonus: int = Field(default=0)
    health_bonus: int = Field(default=0)
    buffs: list[str] = Field(default_factory=list)

    # Computed keyword flags (set during creation)
    has_taunt: bool = Field(default=False)
    has_charge: bool = Field(default=False)
    has_rush: bool = Field(default=False)
    has_enraged: bool = Field(default=False)
    has_shield: bool = Field(default=False)
    rush_locked: bool = Field(default=False)
    attacks_this_turn: int = Field(default=0, ge=0)
    has_drain: bool = Field(default=False)
    has_venom: bool = Field(default=False)
    has_recur: bool = Field(default=False)
    recur_used: bool = Field(default=False)
    stasis: bool = Field(default=False)
    amplify: int = Field(default=0, ge=0)
    has_recycle: bool = Field(default=False)
    has_chain: bool = Field(default=False)
    has_echo: bool = Field(default=False)
    has_excess: bool = Field(default=False)
    has_retaliate: bool = Field(default=False)
    retaliate_used: bool = Field(default=False)
    has_ward: bool = Field(default=False)

    @property
    def current_health(self) -> int:
        """Current health = base health + health_bonus - damage_taken."""
        base = self._base_health
        return max(0, base + self.health_bonus - self.damage_taken)

    @property
    def current_attack(self) -> int:
        """Current attack = base attack + attack_bonus."""
        base = self._base_attack
        return max(0, base + self.attack_bonus)

    @property
    def _base_health(self) -> int:
        """Get base health from the card definition."""
        if isinstance(self.card, CharacterCard):
            return self.card.health
        return 0

    @property
    def _base_attack(self) -> int:
        """Get base attack from the card definition."""
        if isinstance(self.card, CharacterCard):
            return self.card.attack
        return 0

    @property
    def type(self) -> str:
        """Card type string."""
        return self.card.type.value if hasattr(self.card, "type") else "Unknown"

    @property
    def name(self) -> str:
        """Card name."""
        return self.card.name

    @property
    def cost(self) -> int:
        """Card cost."""
        return self.card.cost

    @property
    def is_alive(self) -> bool:
        """True if the character is still on the board (health > 0)."""
        return self.current_health > 0

    @property
    def can_attack(self) -> bool:
        """True if this character is eligible to attack."""
        if self.stasis:
            return False
        return not self.is_exhausted and self.current_attack > 0 and self.is_alive

    def take_damage(self, amount: int) -> int:
        """
        Apply damage to this character. Returns actual damage dealt.
        Ward blocks all damage. Shielding ignores the next instance, then pops.
        """
        if amount < 0:
            raise ValueError("Damage amount must be non-negative")
        if amount == 0:
            return 0
        if self.has_ward:
            return 0
        if self.has_shield:
            self.has_shield = False
            return 0
        self.damage_taken += amount
        return amount

    def heal(self, amount: int) -> int:
        """
        Heal damage. Returns actual healing applied (capped at damage_taken).
        """
        if amount < 0:
            raise ValueError("Healing amount must be non-negative")
        healed = min(amount, self.damage_taken)
        self.damage_taken -= healed
        return healed

    def modify_attack(self, delta: int) -> None:
        """Modify attack bonus (positive = buff, negative = debuff)."""
        self.attack_bonus += delta
        if self.attack_bonus < -self._base_attack:
            self.attack_bonus = -self._base_attack  # prevent going below 0 current

    def modify_health(self, delta: int) -> None:
        """Modify health bonus (positive = buff, negative = debuff)."""
        old_bonus = self.health_bonus
        self.health_bonus += delta
        # If we lose health bonus and it would kill the character, record damage
        if delta < 0 and self.current_health <= 0:
            self.damage_taken = self._base_health + old_bonus  # set to lethal

    def mark_for_combat(self) -> None:
        """Mark this character as having attacked (exhausted unless Enraged)."""
        self.attacks_this_turn += 1
        if self.has_enraged and not self.is_silenced and self.attacks_this_turn < 2:
            self.is_exhausted = False
        else:
            self.is_exhausted = True

    def remove_stealth(self) -> None:
        """Remove stealth (called when the character attacks)."""
        self.is_stealth = False

    def silence(self) -> None:
        """Silence the character (suppress all abilities)."""
        self.is_silenced = True
        self.silence_turns_remaining = -1  # permanent

    def unsilence(self) -> None:
        """Remove silence."""
        self.is_silenced = False
        self.silence_turns_remaining = 0

    def clear_temp_buffs(self) -> None:
        """Clear all temporary end-of-turn buffs/debuffs."""
        self.attack_bonus = 0
        self.health_bonus = 0
        self.buffs = []


def prefix_keywords(ability: str) -> set[str]:
    """Printed leading keywords (Charge. Rush. Taunt. …) before the rules text."""
    found: set[str] = set()
    rest = ability.strip()
    while rest:
        solo = _SOLO_KEYWORD.match(rest)
        if solo:
            found.add(solo.group(1))
            break
        match = _PREFIX_KEYWORD.match(rest)
        if not match:
            break
        found.add(match.group(1))
        rest = rest[match.end() :].lstrip()
    return found


def strip_prefix_keywords(ability: str) -> str:
    """Remove leading keyword prefixes and return the remaining rules text."""
    rest = ability.strip()
    while rest:
        solo = _SOLO_KEYWORD.match(rest)
        if solo:
            return ""
        match = _PREFIX_KEYWORD.match(rest)
        if not match:
            break
        rest = rest[match.end() :].lstrip()
    return rest


def _detect_taunt(card: Card) -> bool:
    if isinstance(card, CharacterCard):
        return "Taunt" in prefix_keywords(card.ability)
    return False


def _detect_stealth(card: Card) -> bool:
    if isinstance(card, CharacterCard):
        return "Stealth" in prefix_keywords(card.ability)
    return False


def _detect_charge(card: Card) -> bool:
    if isinstance(card, CharacterCard):
        return "Charge" in prefix_keywords(card.ability)
    return False


def _detect_rush(card: Card) -> bool:
    if isinstance(card, CharacterCard):
        return "Rush" in prefix_keywords(card.ability)
    return False


def _detect_enraged(card: Card) -> bool:
    if isinstance(card, CharacterCard):
        return "Enraged" in prefix_keywords(card.ability)
    return False


def _detect_shielding(card: Card) -> bool:
    if isinstance(card, CharacterCard):
        return "Shielding" in prefix_keywords(card.ability)
    return False


def has_assault_text(ability: str) -> bool:
    """True if the text is an Assault / when-played trigger."""
    lower = ability.lower()
    return "assault:" in lower or "when played" in lower


def has_deathrattle_text(ability: str) -> bool:
    """True if the text is a Deathrattle / on-death trigger."""
    lower = ability.lower()
    return "deathrattle:" in lower or "when this character dies" in lower


def has_discovery_text(text: str) -> bool:
    """True if the text Discoveries a card into hand."""
    lower = text.lower()
    return "discover" in lower or lower.startswith("discovery")


def is_token_card(card: Card) -> bool:
    """Tokens are summoned pieces, not constructed-deck cards."""
    ability = getattr(card, "ability", "") or ""
    return ability.startswith("Token")


def create_card_instance(card: Card, instance_id: str, owner: str = "") -> CardInstance:
    """Factory: create a CardInstance from a static Card definition."""
    is_stealth = _detect_stealth(card)
    has_taunt = _detect_taunt(card)
    keys = prefix_keywords(getattr(card, "ability", "") or getattr(card, "effect", "") or "")
    has_charge = "Charge" in keys
    has_rush = "Rush" in keys
    has_enraged = "Enraged" in keys
    has_shield = "Shielding" in keys
    ready = has_charge or has_rush
    is_exhausted = isinstance(card, CharacterCard) and not ready
    amplify = 1 if "Amplify" in keys else 0

    return CardInstance(
        card=card,
        instance_id=instance_id,
        owner=owner,
        is_exhausted=is_exhausted,
        is_stealth=is_stealth,
        has_taunt=has_taunt,
        has_charge=has_charge,
        has_rush=has_rush,
        has_enraged=has_enraged,
        has_shield=has_shield,
        rush_locked=has_rush and not has_charge,
        has_drain="Drain" in keys,
        has_venom="Venom" in keys,
        has_recur="Recur" in keys,
        amplify=amplify,
        has_recycle="Recycle" in keys,
        has_chain="Chain" in keys,
        has_echo="Echo" in keys,
        has_excess="Excess" in keys,
        has_retaliate="Retaliate" in keys,
        has_ward="Ward" in keys,
    )
