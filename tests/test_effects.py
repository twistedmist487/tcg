"""Tests for engine/effects.py — effect resolution engine."""

import pytest

from engine.card import create_card_instance
from engine.effects import (
    EffectResult,
    resolve_card_draw_discard,
    resolve_damage_all_enemies,
    resolve_debuff_attack,
    resolve_end_of_turn_locations,
    resolve_heal,
    resolve_holy_inquisition,
    resolve_mind_control,
    resolve_on_play_ability,
    resolve_silence_all,
    resolve_spell_damage,
    resolve_spell_effect,
    resolve_spray_damage,
    resolve_start_of_turn_locations,
)
from engine.game import Game
from engine.models import CharacterCard, SpellCard, load_cards
from engine.player import Player


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_game(p1_faction="illuminati", p2_faction="templars"):
    """Create a test game with 20-card decks per faction."""
    cards = load_cards("data/cards.json")
    deck1 = [c for c in cards if c.faction.value == p1_faction][:10]
    deck1 = deck1 * 2  # 20 cards
    deck2 = [c for c in cards if c.faction.value == p2_faction][:10]
    deck2 = deck2 * 2
    return Game.setup(deck1, deck2, "Human", "AI")


def _char_card(
    name="TestChar", cost=2, attack=2, health=3,
    faction="illuminati", ability="None",
):
    energy = {"illuminati": "Influence", "templars": "Faith", "reptilians": "Psionics"}.get(faction, "Influence")
    return CharacterCard(
        id=f"{faction}_char_999", name=name, faction=faction,
        energy_type=energy, cost=cost, lore="test",
        attack=attack, health=health, ability=ability,
    )


def _spell_card(
    name="TestSpell", cost=2, faction="illuminati",
    effect="Deal 2 damage to a target character.",
):
    energy = {"illuminati": "Influence", "templars": "Faith", "reptilians": "Psionics"}.get(faction, "Influence")
    return SpellCard(
        id=f"{faction}_spell_999", name=name, faction=faction,
        energy_type=energy, cost=cost, lore="test",
        effect=effect,
    )


def _enemy_on_board(game, name="EnemyChar", attack=2, health=4, faction="templars"):
    """Place a character on the AI's board for testing targeting."""
    card = _char_card(name=name, attack=attack, health=health, faction=faction)
    instance = create_card_instance(card, f"enemy_{name}", game.players[1].name)
    instance.is_exhausted = False
    game.players[1].board.append(instance)
    return instance


# ---------------------------------------------------------------------------
# EffectResult
# ---------------------------------------------------------------------------

class TestEffectResult:
    def test_create_basic(self):
        r = EffectResult(effect_type="test", success=True, description="did thing")
        assert r.effect_type == "test"
        assert r.success is True
        assert r.description == "did thing"

    def test_to_dict_excludes_empty(self):
        r = EffectResult(effect_type="test", success=True)
        d = r.to_dict()
        assert "damage_dealt" not in d
        assert "effect_type" in d

    def test_to_dict_includes_nonempty(self):
        r = EffectResult(effect_type="test", success=True, damage_dealt={"foo": 5})
        d = r.to_dict()
        assert d["damage_dealt"] == {"foo": 5}


# ---------------------------------------------------------------------------
# Spell: Single target damage (Divine Smite)
# ---------------------------------------------------------------------------

class TestResolveSpellDamage:
    def test_deals_damage_to_target(self):
        game = _make_game()
        target = _enemy_on_board(game)
        spell = _spell_card(effect="Deal 4 damage to a target character.")
        result = resolve_spell_damage(game, game.active_player.name, spell, target)
        assert result.success is True
        assert target.damage_taken == 4

    def test_no_target_returns_failure(self):
        game = _make_game()
        spell = _spell_card(effect="Deal 4 damage to a target character.")
        result = resolve_spell_damage(game, game.active_player.name, spell, None)
        assert result.success is False

    def test_parses_damage_amount(self):
        game = _make_game()
        target = _enemy_on_board(game)
        spell = _spell_card(effect="Deal 7 damage to a target character.")
        resolve_spell_damage(game, game.active_player.name, spell, target)
        assert target.damage_taken == 7


# ---------------------------------------------------------------------------
# Spell: Silence all (Media Blackout)
# ---------------------------------------------------------------------------

class TestResolveSilenceAll:
    def test_silences_all_enemies(self):
        game = _make_game()
        e1 = _enemy_on_board(game, name="E1")
        e2 = _enemy_on_board(game, name="E2")
        spell = _spell_card(effect="Silence all enemy characters until end of turn.")
        result = resolve_silence_all(game, game.active_player.name, spell)
        assert result.success is True
        assert e1.is_silenced is True
        assert e2.is_silenced is True

    def test_no_enemies_still_resolves(self):
        game = _make_game()
        spell = _spell_card(effect="Silence all enemy characters until end of turn.")
        result = resolve_silence_all(game, game.active_player.name, spell)
        assert result.success is True


# ---------------------------------------------------------------------------
# Spell: Silence + damage (Holy Inquisition)
# ---------------------------------------------------------------------------

class TestResolveHolyInquisition:
    def test_silences_and_deals_damage(self):
        game = _make_game()
        target = _enemy_on_board(game)
        spell = _spell_card(effect="Silence and deal 3 damage to an enemy character.")
        result = resolve_holy_inquisition(game, game.active_player.name, spell, target)
        assert result.success is True
        assert target.is_silenced is True
        assert target.damage_taken == 3

    def test_no_target_fails(self):
        game = _make_game()
        spell = _spell_card(effect="Silence and deal 3 damage to an enemy character.")
        result = resolve_holy_inquisition(game, game.active_player.name, spell, None)
        assert result.success is False


# ---------------------------------------------------------------------------
# Spell: Heal (Absolution)
# ---------------------------------------------------------------------------

class TestResolveHeal:
    def test_heals_character(self):
        game = _make_game()
        target = _enemy_on_board(game)
        target.take_damage(3)  # deal 3 damage first
        spell = _spell_card(effect="Restore 5 Health to your hero or a character. Draw a card.")
        result = resolve_heal(game, game.active_player.name, spell, target_instance=target)
        assert result.success is True
        assert target.damage_taken == 0  # healed 3 (capped at damage dealt)

    def test_heals_player(self):
        game = _make_game()
        player = game.active_player
        player.life = 20
        spell = _spell_card(effect="Restore 5 Health to your hero or a character. Draw a card.")
        result = resolve_heal(game, player.name, spell, target_player=player)
        assert result.success is True
        assert player.life == 25


# ---------------------------------------------------------------------------
# Spell: Attack debuff (Neural Scramble)
# ---------------------------------------------------------------------------

class TestResolveDebuffAttack:
    def test_reduces_attack(self):
        game = _make_game()
        target = _enemy_on_board(game, attack=4)
        spell = _spell_card(effect="Give an enemy character -2 Attack until end of turn.")
        result = resolve_debuff_attack(game, game.active_player.name, spell, target)
        assert result.success is True
        assert target.attack_bonus == -2

    def test_no_target_fails(self):
        game = _make_game()
        spell = _spell_card(effect="Give an enemy character -2 Attack until end of turn.")
        result = resolve_debuff_attack(game, game.active_player.name, spell, None)
        assert result.success is False


# ---------------------------------------------------------------------------
# Spell: Mind control (Manchurian Protocol)
# ---------------------------------------------------------------------------

class TestResolveMindControl:
    def test_steals_low_atk_character(self):
        game = _make_game()
        target = _enemy_on_board(game, attack=2, health=3)
        enemy_player = game.players[1]
        spell = _spell_card(
            effect="Take control of an enemy character with 3 or less Attack. It gains +2 Attack."
        )
        result = resolve_mind_control(game, game.active_player.name, spell, target, atk_threshold=3, buff_atk=2)
        assert result.success is True
        assert len(enemy_player.board) == 0  # removed from enemy
        assert len(game.active_player.board) == 1  # added to caster

    def test_refuses_high_atk_character(self):
        game = _make_game()
        target = _enemy_on_board(game, attack=5, health=3)
        spell = _spell_card(
            effect="Take control of an enemy character with 3 or less Attack. It gains +2 Attack."
        )
        result = resolve_mind_control(game, game.active_player.name, spell, target, atk_threshold=3, buff_atk=2)
        assert result.success is False


# ---------------------------------------------------------------------------
# Spell: Spray damage (Orbital Strike)
# ---------------------------------------------------------------------------

class TestResolveSprayDamage:
    def test_primary_and_splash(self):
        game = _make_game()
        target = _enemy_on_board(game, name="Primary", health=10)
        other = _enemy_on_board(game, name="Other", health=10)
        spell = _spell_card(
            effect="Deal 6 damage to an enemy character. Deal 3 damage to all other enemy characters."
        )
        result = resolve_spray_damage(game, game.active_player.name, spell, target)
        assert result.success is True
        assert target.damage_taken == 6
        assert other.damage_taken == 3

    def test_no_target_fails(self):
        game = _make_game()
        spell = _spell_card(
            effect="Deal 6 damage to an enemy character. Deal 3 damage to all other enemy characters."
        )
        result = resolve_spray_damage(game, game.active_player.name, spell, None)
        assert result.success is False


# ---------------------------------------------------------------------------
# Spell: AOE damage all (Ancient Star Map)
# ---------------------------------------------------------------------------

class TestResolveDamageAllEnemies:
    def test_two_damage_to_all(self):
        game = _make_game()
        _enemy_on_board(game, name="E1", health=10)
        _enemy_on_board(game, name="E2", health=10)
        spell = _spell_card(effect="Deal 2 damage to all enemy characters. Draw a card.")
        result = resolve_spell_effect(game, game.active_player.name, spell)
        assert result.success is True


# ---------------------------------------------------------------------------
# Spell dispatcher
# ---------------------------------------------------------------------------

class TestResolveSpellEffect:
    def test_dispatch_damage(self):
        game = _make_game()
        target = _enemy_on_board(game, health=10)
        spell = _spell_card(effect="Deal 4 damage to a target character.")
        result = resolve_spell_effect(game, game.active_player.name, spell, target)
        assert result.success is True
        assert target.damage_taken == 4

    def test_dispatch_silence_all(self):
        game = _make_game()
        _enemy_on_board(game)
        spell = _spell_card(effect="Silence all enemy characters until end of turn.")
        result = resolve_spell_effect(game, game.active_player.name, spell)
        assert result.success is True

    def test_dispatch_silence_damage(self):
        game = _make_game()
        target = _enemy_on_board(game, health=10)
        spell = _spell_card(effect="Silence and deal 3 damage to an enemy character.")
        result = resolve_spell_effect(game, game.active_player.name, spell, target)
        assert result.success is True
        assert target.is_silenced is True

    def test_dispatch_mind_control(self):
        game = _make_game()
        target = _enemy_on_board(game, attack=2)
        spell = _spell_card(
            effect="Take control of an enemy character with 3 or less Attack. It gains +2 Attack."
        )
        result = resolve_spell_effect(game, game.active_player.name, spell, target)
        assert result.success is True

    def test_dispatch_card_draw_discard(self):
        game = _make_game()
        spell = _spell_card(effect="Draw 2 cards. Each player discards 1 card.")
        result = resolve_spell_effect(game, game.active_player.name, spell)
        assert result.success is True

    def test_dispatch_debuff(self):
        game = _make_game()
        target = _enemy_on_board(game, attack=4)
        spell = _spell_card(effect="Give an enemy character -2 Attack until end of turn.")
        result = resolve_spell_effect(game, game.active_player.name, spell, target)
        assert result.success is True
        assert target.attack_bonus == -2


# ---------------------------------------------------------------------------
# Card draw + discard (Black Budget)
# ---------------------------------------------------------------------------

class TestResolveCardDrawDiscard:
    def test_draws_two_cards(self):
        game = _make_game()
        player = game.active_player
        hand_before = len(player.hand)
        spell = _spell_card(effect="Draw 2 cards. Each player discards 1 card.")
        result = resolve_card_draw_discard(game, player.name, spell)
        assert result.success is True
        # Drew 2, but discarded 1 = net +1 (approximately, depending on discard)
        assert len(player.hand) >= hand_before + 1

    def test_each_player_discards(self):
        game = _make_game()
        spell = _spell_card(effect="Draw 2 cards. Each player discards 1 card.")
        p1_hand = len(game.players[0].hand)
        p2_hand = len(game.players[1].hand)
        result = resolve_card_draw_discard(game, game.active_player.name, spell)
        assert result.success is True
        assert "discarded" in result.description.lower() or len(result.discarded) > 0


# ---------------------------------------------------------------------------
# Character on-play abilities
# ---------------------------------------------------------------------------

class TestResolveOnPlayAbility:
    def test_shadow_broker_discards_from_opponent_hand(self):
        game = _make_game()
        player = game.active_player
        opponent = game.inactive_player
        # Give opponent some cards
        opponent.hand = [_char_card(name="HandCard1"), _char_card(name="HandCard2")]

        shadow_broker_card = _char_card(
            name="Shadow Broker", ability="When played, look at opponent's hand and discard one card."
        )
        instance = create_card_instance(shadow_broker_card, "sb_1", player.name)
        player.board.append(instance)

        hand_before = len(opponent.hand)
        result = resolve_on_play_ability(game, player.name, instance)
        assert result.success is True
        assert len(opponent.hand) == hand_before - 1

    def test_steal_ability(self):
        game = _make_game()
        player = game.active_player
        opponent = game.inactive_player
        target = _enemy_on_board(game, attack=2)

        dominator_card = _char_card(
            name="Psionic Dominator",
            ability="When played, take control of an enemy character with 2 or less Attack until end of turn."
        )
        instance = create_card_instance(dominator_card, "dom_1", player.name)
        player.board.append(instance)

        enemy_count_before = len(opponent.board)
        result = resolve_on_play_ability(game, player.name, instance)
        assert result.success is True
        assert len(opponent.board) == enemy_count_before - 1

    def test_bounce_ability(self):
        game = _make_game()
        player = game.active_player
        opponent = game.players[1]
        target = _enemy_on_board(game, attack=3)

        specialist_card = _char_card(
            name="Abduction Specialist",
            ability="When played, return an enemy character with 3 or less Attack to its owner's hand."
        )
        instance = create_card_instance(specialist_card, "abs_1", player.name)
        player.board.append(instance)

        result = resolve_on_play_ability(game, player.name, instance)
        assert result.success is True
        assert len(opponent.board) == 0
        assert len(opponent.hand) > 0  # bounced card returns to hand


# ---------------------------------------------------------------------------
# Location start-of-turn effects
# ---------------------------------------------------------------------------

class TestResolveStartOfTurnLocations:
    def test_sacred_chapel_heals_all(self):
        game = _make_game()
        player = game.active_player
        # Place a friendly character with damage
        friendly = create_card_instance(_char_card(), "f1", player.name)
        friendly.take_damage(3)
        player.board.append(friendly)

        # Place location
        loc_card = _spell_card(  # not a location but we trick it
            name="Sacred Chapel",
            effect="At the start of your turn, heal 1 damage from all your characters.",
        )
        # Actually use a location card
        from engine.models import LocationCard
        energy = "Faith"
        loc = LocationCard(
            id="templars_loc_999", name="Sacred Chapel", faction="templars",
            energy_type=energy, cost=4, lore="test",
            effect="At the start of your turn, heal 1 damage from all your characters.",
        )
        loc_instance = create_card_instance(loc, "loc_1", player.name)
        player.location = loc_instance

        assert friendly.damage_taken == 3
        results = resolve_start_of_turn_locations(game, player)
        assert len(results) > 0
        assert friendly.damage_taken == 2  # healed 1

    def test_no_location_returns_empty(self):
        game = _make_game()
        player = game.active_player
        results = resolve_start_of_turn_locations(game, player)
        assert results == []

    def test_holy_grail_sanctum_heals_damaged(self):
        game = _make_game()
        player = game.active_player
        from engine.models import LocationCard
        loc = LocationCard(
            id="templars_loc_998", name="Holy Grail Sanctum", faction="templars",
            energy_type="Faith", cost=5, lore="test",
            effect="At the start of your turn, if you have a damaged character, restore 2 Health to it.",
        )
        loc_instance = create_card_instance(loc, "loc_2", player.name)
        player.location = loc_instance

        friendly = create_card_instance(_char_card(), "f2", player.name)
        friendly.take_damage(5)
        player.board.append(friendly)

        resolve_start_of_turn_locations(game, player)
        assert friendly.damage_taken == 3  # healed 2

    def test_holy_grail_no_damaged_no_heal(self):
        game = _make_game()
        player = game.active_player
        from engine.models import LocationCard
        loc = LocationCard(
            id="templars_loc_997", name="Holy Grail Sanctum", faction="templars",
            energy_type="Faith", cost=5, lore="test",
            effect="At the start of your turn, if you have a damaged character, restore 2 Health to it.",
        )
        loc_instance = create_card_instance(loc, "loc_3", player.name)
        player.location = loc_instance

        friendly = create_card_instance(_char_card(), "f3", player.name)
        # No damage
        player.board.append(friendly)

        results = resolve_start_of_turn_locations(game, player)
        assert friendly.damage_taken == 0


# ---------------------------------------------------------------------------
# Location end-of-turn effects
# ---------------------------------------------------------------------------

class TestResolveEndOfTurnLocations:
    def test_bilderberg_estate_draws_with_board_advantage(self):
        game = _make_game()
        player = game.active_player
        from engine.models import LocationCard
        loc = LocationCard(
            id="illuminati_loc_999", name="Bilderberg Estate", faction="illuminati",
            energy_type="Influence", cost=6, lore="test",
            effect="At the end of your turn, if you control more characters than your opponent, draw a card.",
        )
        loc_instance = create_card_instance(loc, "loc_e1", player.name)
        player.location = loc_instance

        # Player has 2 chars, opponent has 0
        c1 = create_card_instance(_char_card(), "c1", player.name)
        c2 = create_card_instance(_char_card(), "c2", player.name)
        player.board = [c1, c2]
        game.players[1].board = []

        hand_before = len(player.hand)
        resolve_end_of_turn_locations(game, player)
        assert len(player.hand) > hand_before

    def test_bilderberg_no_draw_without_advantage(self):
        game = _make_game()
        player = game.active_player
        from engine.models import LocationCard
        loc = LocationCard(
            id="illuminati_loc_998", name="Bilderberg Estate", faction="illuminati",
            energy_type="Influence", cost=6, lore="test",
            effect="At the end of your turn, if you control more characters than your opponent, draw a card.",
        )
        loc_instance = create_card_instance(loc, "loc_e2", player.name)
        player.location = loc_instance

        # No characters on either side
        player.board = []
        game.players[1].board = []

        hand_before = len(player.hand)
        resolve_end_of_turn_locations(game, player)
        assert len(player.hand) == hand_before  # no draw

    def test_no_location_returns_empty(self):
        game = _make_game()
        player = game.active_player
        results = resolve_end_of_turn_locations(game, player)
        assert results == []


# ---------------------------------------------------------------------------
# Integration: spell effects through Game.play_card
# ---------------------------------------------------------------------------

class TestSpellIntegration:
    def test_play_spell_damages_enemy(self):
        game = _make_game()
        game.start_turn()
        target = _enemy_on_board(game, health=10)
        spell = _spell_card(effect="Deal 4 damage to a target character.")

        # Put spell in hand and ensure enough energy
        game.active_player.hand.append(spell)
        game.active_player.energy = 10

        # Target index 0 on opponent's board
        result = game.play_card(len(game.active_player.hand) - 1,
                                spell_target_index=0)
        assert result["success"] is True
        assert result["action"] == "play_spell"
        assert "effect" in result

    def test_play_spell_returns_effect_dict(self):
        game = _make_game()
        game.start_turn()
        spell = _spell_card(effect="Silence all enemy characters until end of turn.")
        _enemy_on_board(game)
        game.active_player.hand.append(spell)
        game.active_player.energy = 10

        result = game.play_card(len(game.active_player.hand) - 1)
        assert "effect" in result
        assert result["effect"]["effect_type"] == "silence_all"

    def test_lethal_spell_removes_dead_character(self):
        game = _make_game()
        game.start_turn()
        _enemy_on_board(game, name="Glass", health=2)
        spell = _spell_card(effect="Deal 4 damage to a target character.")
        game.active_player.hand.append(spell)
        game.active_player.energy = 10

        result = game.play_card(len(game.active_player.hand) - 1, spell_target_index=0)
        assert result["success"] is True
        assert game.inactive_player.board == []
        assert "Glass" in result.get("slain", {}).get("opponent_slain", [])


    def test_wiretap_bumps_hand_cost(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        wiretap = cards["illuminati_spell_008"]
        game = Game.setup([pawn] * 30, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        victim = game.inactive_player.hand[0]
        before = victim.cost
        game.active_player.hand.append(wiretap)
        result = game.play_card(len(game.active_player.hand) - 1)
        assert result["success"] is True
        bumped = [c for c in game.inactive_player.hand if game.inactive_player.play_cost(c) > c.cost]
        assert bumped
        assert game.inactive_player.play_cost(bumped[0]) == bumped[0].cost + 2


class TestTargetedEffects:
    def test_judgment_damages_and_heals(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        judgment = cards["templars_spell_006"]
        game = Game.setup([pawn] * 30, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        game.active_player.life = 20
        dummy = create_card_instance(pawn, "e1", "B")
        dummy.modify_health(4)
        game.inactive_player.board = [dummy]
        game.active_player.hand.append(judgment)
        result = game.play_card(len(game.active_player.hand) - 1, spell_target_index=0)
        assert result["success"] is True
        assert dummy.current_health == pawn.health + 4 - 5
        assert game.active_player.life == 25

    def test_consecration_hits_all(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        spell = cards["templars_spell_004"]
        game = Game.setup([pawn] * 30, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        a = create_card_instance(pawn, "e1", "B")
        b = create_card_instance(pawn, "e2", "B")
        game.inactive_player.board = [a, b]
        game.active_player.hand.append(spell)
        result = game.play_card(len(game.active_player.hand) - 1)
        assert result["success"] is True
        assert a.damage_taken == 1
        assert b.damage_taken == 1

    def test_absolution_defaults_to_hero(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        spell = cards["templars_spell_003"]
        game = Game.setup([pawn] * 30, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        game.active_player.life = 20
        game.active_player.hand.append(spell)
        result = game.play_card(len(game.active_player.hand) - 1, target_side="hero")
        assert result["success"] is True
        assert game.active_player.life == 25

    def test_friendly_buff_needs_ally(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        spell = cards["templars_spell_008"]
        game = Game.setup([pawn] * 30, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        ally = create_card_instance(pawn, "a1", "A")
        game.active_player.board = [ally]
        game.active_player.hand.append(spell)
        result = game.play_card(
            len(game.active_player.hand) - 1,
            spell_target_index=0,
            target_side="ally",
        )
        assert result["success"] is True
        assert ally.current_attack == pawn.attack + 3

    def test_abduction_beam_bounces(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        spell = cards["reptilians_spell_006"]
        game = Game.setup([pawn] * 30, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        dummy = create_card_instance(pawn, "e1", "B")
        game.inactive_player.board = [dummy]
        game.active_player.hand.append(spell)
        result = game.play_card(len(game.active_player.hand) - 1, spell_target_index=0)
        assert result["success"] is True
        assert game.inactive_player.board == []
        assert any(c.name == pawn.name for c in game.inactive_player.hand)

    def test_assault_uses_clicked_target(self):
        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        strike = cards["neutral_char_012"]
        game = Game.setup([pawn] * 30, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        dummy = create_card_instance(pawn, "e1", "B")
        game.inactive_player.board = [dummy]
        game.active_player.hand.append(strike)
        result = game.play_card(len(game.active_player.hand) - 1, spell_target_index=0)
        assert result["success"] is True
        assert dummy.current_health == pawn.health - 2
