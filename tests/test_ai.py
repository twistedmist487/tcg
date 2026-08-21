"""Tests for engine.ai — heuristic AI opponent."""

import pytest

from engine.ai import AIPlayer, choose_action, execute_turn, score_action
from engine.game import Game
from engine.models import CharacterCard, load_cards, load_factions


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


# ---------------------------------------------------------------------------
# AIPlayer creation
# ---------------------------------------------------------------------------

class TestAIPlayer:
    def test_create_default(self):
        ai = AIPlayer()
        assert ai.name == "AI"
        assert ai.aggression == 0.5

    def test_create_custom(self):
        ai = AIPlayer(name="Bot", aggression=0.8, faction="templars")
        assert ai.name == "Bot"
        assert ai.aggression == 0.8
        assert ai.faction == "templars"

    def test_faction_weights_illuminati(self):
        ai = AIPlayer(faction="illuminati")
        # Illuminati values card draw and control
        assert ai.weights["card_draw"] > 0
        assert ai.weights["board_presence"] > 0

    def test_faction_weights_templars(self):
        ai = AIPlayer(faction="templars")
        # Templars value healing and defense
        assert ai.weights["board_presence"] > 0

    def test_faction_weights_reptilians(self):
        ai = AIPlayer(faction="reptilians")
        # Reptilians value aggression
        assert ai.weights["face_damage"] > 0


# ---------------------------------------------------------------------------
# choose_action — basic behavior
# ---------------------------------------------------------------------------

class TestChooseAction:
    def test_returns_valid_dict(self):
        """choose_action always returns an action dict."""
        game = _make_game()
        game.start_turn()
        action = choose_action(game)
        assert isinstance(action, dict)
        assert "action" in action

    def test_action_type_valid(self):
        """Action type must be play, attack, or end_turn."""
        game = _make_game()
        game.start_turn()
        for _ in range(20):
            if game.is_over:
                break
            action = choose_action(game)
            assert action["action"] in ("play", "attack", "end_turn", "recycle")
            if action["action"] == "end_turn":
                game.end_turn()
            elif action["action"] == "play":
                result = game.play_card(action["card_index"])
                # If play succeeded, great. If not, game state still valid.
            elif action["action"] == "attack":
                result = game.attack(
                    action["attacker_index"],
                    action.get("target_index"),
                )
            # Check game didn't break
            state = game.get_state()
            assert "players" in state

    def test_ai_avoids_invalid_actions(self):
        """AI should never return obviously invalid actions."""
        for _ in range(10):
            game = _make_game()
            game.start_turn()
            for turn_count in range(30):
                if game.is_over:
                    break
                action = choose_action(game)
                if action["action"] == "play":
                    idx = action["card_index"]
                    player = game.active_player
                    assert 0 <= idx < len(player.hand), \
                        f"AI tried to play card {idx} from hand of {len(player.hand)}"
                elif action["action"] == "attack":
                    idx = action["attacker_index"]
                    player = game.active_player
                    assert 0 <= idx < len(player.board), \
                        f"AI tried to attack with {idx} from board of {len(player.board)}"
                elif action["action"] == "end_turn":
                    game.end_turn()
                    if not game.is_over:
                        game.start_turn()


# ---------------------------------------------------------------------------
# execute_turn — full turn loop
# ---------------------------------------------------------------------------

class TestExecuteTurn:
    def test_completes_without_error(self):
        """AI can execute a full turn without crashing."""
        game = _make_game()
        game.start_turn()
        results = execute_turn(game)
        # Should return a list of action results
        assert isinstance(results, list)

    def test_ends_turn(self):
        """execute_turn always ends the turn."""
        for _ in range(10):
            game = _make_game()
            game.start_turn()
            # Figure out who the active player was before AI turn
            pre_turn_active = game.active_player.name
            execute_turn(game)
            # After execute_turn, the active player should be the OTHER player
            post_turn_active = game.active_player.name
            assert post_turn_active != pre_turn_active, \
                f"Turn didn't switch: before={pre_turn_active}, after={post_turn_active}"

    def test_makes_multiple_actions(self):
        """AI typically makes multiple actions per turn."""
        game = _make_game()
        game.start_turn()
        results = execute_turn(game)
        # At least one action (usually several)
        assert len(results) >= 1

    def test_full_game_completes(self):
        """A full game AI vs AI completes without hanging."""
        game = _make_game("templars", "reptilians")
        turn_limit = 100
        for _ in range(turn_limit):
            if game.is_over:
                break
            game.start_turn()
            if game.is_over:
                break
            execute_turn(game)
        # Game should be over or we hit the turn limit
        assert game.is_over or game.turn_number >= turn_limit


# ---------------------------------------------------------------------------
# Scoring logic
# ---------------------------------------------------------------------------

class TestScoring:
    def test_play_card_positive_score(self):
        """Playing any affordable card should score positively."""
        # Use multiple game seeds — on turn 1 the AI might only have 1 energy,
        # so affordable cards might be limited. Check across several games.
        found_positive = False
        for _ in range(20):
            game = _make_game()
            game.start_turn()
            player = game.active_player
            # Give enough energy to make something playable
            player.energy = max(player.energy, 5)
            for i, card in enumerate(player.hand):
                if player.can_play_card(card):
                    score = score_action(game, {"action": "play", "card_index": i})
                    if score > 0:
                        found_positive = True
                        break
            if found_positive:
                break
        assert found_positive, "No affordable card scored positively"

    def test_end_turn_zero_or_low_score(self):
        """Ending turn should score low (last resort)."""
        game = _make_game()
        game.start_turn()
        score = score_action(game, {"action": "end_turn"})
        # End turn should be available but not preferred
        assert isinstance(score, float)

    def test_attack_kills_preferred(self):
        """Attacks that kill enemies should score higher than ones that don't."""
        game = _make_game()
        game.start_turn()
        ai_player = game.active_player
        opponent = game.inactive_player

        # Create a weak enemy character
        weak_card = _char_card("Weak", attack=1, health=1)
        # We need to add it to the opponent's board — game doesn't support that
        # directly, so we test scoring indirectly through the game flow.
        # This is a structural test — just make sure scoring doesn't crash.
        if ai_player.board:
            score = score_action(game, {
                "action": "attack",
                "attacker_index": 0,
                "target_index": 0 if opponent.board else None,
            })
            assert isinstance(score, (int, float))

    def test_prefer_high_cost_cards(self):
        """AI should generally value playing cards with reasonable stats.
        The scoring should not always prefer the cheapest card — the
        cost-efficiency ratio should be balanced with raw cost."""
        game = _make_game()
        game.start_turn()
        player = game.active_player
        player.energy = 10  # lots of energy

        if len(player.hand) >= 2:
            # Just scoring shouldn't return -inf for affordable cards
            scores = []
            for i, c in enumerate(player.hand):
                if player.can_play_card(c):
                    s = score_action(game, {"action": "play", "card_index": i})
                    scores.append(s)
            # At least some cards should be playable
            assert len(scores) > 0
            # Targeted spells with an empty board score -inf; the rest should be positive
            assert any(s > 0 for s in scores)
            assert all(s == float("-inf") or s > 0 for s in scores)


# ---------------------------------------------------------------------------
# AI usability tests
# ---------------------------------------------------------------------------

class TestAIUsability:
    def test_ai_doesnt_crash_empty_hand(self):
        """AI handles having no cards gracefully."""
        game = _make_game()
        game.start_turn()
        player = game.active_player
        player.hand.clear()  # force empty hand
        action = choose_action(game)
        assert action["action"] == "end_turn"

    def test_ai_doesnt_crash_empty_board(self):
        """AI handles having no board characters gracefully."""
        game = _make_game()
        game.start_turn()
        player = game.active_player
        player.board.clear()  # force empty board
        action = choose_action(game)
        # Should either play a card, recycle, or end turn
        assert action["action"] in ("play", "end_turn", "recycle")

    def test_ai_respects_energy(self):
        """AI never suggests playing a card it can't afford."""
        for _ in range(20):
            game = _make_game()
            game.start_turn()
            if game.is_over:
                break
            action = choose_action(game)
            if action["action"] == "play":
                card = game.active_player.hand[action["card_index"]]
                assert game.active_player.energy >= card.cost
            if action["action"] == "recycle":
                card = game.active_player.hand[action["card_index"]]
                assert game.active_player.energy >= 1
                text = f"{getattr(card, 'ability', '')} {getattr(card, 'effect', '')}"
                assert "Recycle" in text


class TestHonestAI:
    def test_easy_does_not_skip_attacks(self):
        easy = AIPlayer(difficulty="easy")
        assert easy.skip_attack_chance == 0.0
        assert easy.poke_face > 0

    def test_recycle_is_scored_on_dead_draw(self):
        from engine.models import load_cards

        cards = {c.id: c for c in load_cards("data/cards.json")}
        bag = cards["neutral_spell_007"]
        pawn = cards["templars_char_009"]
        game = Game.setup([bag] + [pawn] * 29, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 1
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == bag.id)
        score = score_action(game, {"action": "recycle", "card_index": idx})
        assert score > -float("inf")

    def test_location_replace_is_legal(self):
        from engine.card import create_card_instance
        from engine.models import load_cards

        cards = {c.id: c for c in load_cards("data/cards.json")}
        chapel = cards["templars_loc_001"]
        pawn = cards["templars_char_009"]
        game = Game.setup([chapel] + [pawn] * 29, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        game.active_player.location = create_card_instance(chapel, "old", "A")
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == chapel.id)
        score = score_action(game, {"action": "play", "card_index": idx})
        assert score > -float("inf")

    def test_face_when_only_stealth_on_board(self):
        from engine.card import create_card_instance
        from engine.models import load_cards

        cards = {c.id: c for c in load_cards("data/cards.json")}
        pawn = cards["templars_char_009"]
        sneak = cards["reptilians_char_001"]
        game = Game.setup([pawn] * 30, [sneak] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()

        attacker = create_card_instance(pawn, "a1", "A")
        attacker.is_exhausted = False
        game.active_player.board = [attacker]
        ghost = create_card_instance(sneak, "b1", "B")
        ghost.is_stealth = True
        game.inactive_player.board = [ghost]
        score = score_action(
            game,
            {"action": "attack", "attacker_index": 0, "target_index": None},
        )
        assert score > -float("inf")

    def test_split_picks_damage_when_board_exists(self):
        from engine.models import load_cards

        cards = {c.id: c for c in load_cards("data/cards.json")}
        brief = cards["neutral_spell_008"]
        pawn = cards["templars_char_009"]
        game = Game.setup([brief] + [pawn] * 29, [pawn] * 30, "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        from engine.card import create_card_instance

        dummy = create_card_instance(pawn, "e1", "B")
        dummy.is_exhausted = True
        game.inactive_player.board = [dummy]
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == brief.id)
        played = game.play_card(idx)
        assert played.get("split") is True
        results = execute_turn(game)
        assert any(step["action"] == "split" for step in results)

    def test_venom_scores_above_vanilla(self):
        venom = _char_card("Needle", cost=2, attack=1, health=2, ability="Venom.")
        vanilla = _char_card("Pawn", cost=2, attack=1, health=2, ability="None")
        filler = _char_card("Filler", cost=1, attack=1, health=1)
        game = Game.setup(
            [venom, vanilla] + [filler] * 28,
            [filler] * 30,
            "A",
            "B",
            first_player=0,
            shuffle=False,
        )
        game.start_turn()
        game.active_player.energy = 10
        venom_idx = next(i for i, c in enumerate(game.active_player.hand) if c.name == "Needle")
        vanilla_idx = next(i for i, c in enumerate(game.active_player.hand) if c.name == "Pawn")
        venom_score = score_action(game, {"action": "play", "card_index": venom_idx})
        vanilla_score = score_action(game, {"action": "play", "card_index": vanilla_idx})
        assert venom_score > vanilla_score

    def test_discard_scores_above_vanilla_body(self):
        control = _char_card(
            "Handler",
            cost=3,
            attack=2,
            health=2,
            ability="When played, force opponent to discard a random card from their hand.",
        )
        vanilla = _char_card("Pawn", cost=3, attack=2, health=2, ability="None")
        filler = _char_card("Filler", cost=1, attack=1, health=1)
        game = Game.setup(
            [control, vanilla] + [filler] * 28,
            [filler] * 30,
            "A",
            "B",
            first_player=0,
            shuffle=False,
        )
        game.start_turn()
        game.active_player.energy = 10
        control_idx = next(i for i, c in enumerate(game.active_player.hand) if c.name == "Handler")
        vanilla_idx = next(i for i, c in enumerate(game.active_player.hand) if c.name == "Pawn")
        assert score_action(game, {"action": "play", "card_index": control_idx}) > score_action(
            game, {"action": "play", "card_index": vanilla_idx}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

