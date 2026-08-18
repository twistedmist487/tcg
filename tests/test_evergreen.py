"""Evergreen keyword wave: Drain, Venom, Recur, Stasis, Amplify, Recycle,
Chain, Split, Echo, Excess, Retaliate, Flash, Manifest, Opening, Ward."""

from engine.card import create_card_instance, prefix_keywords, strip_prefix_keywords
from engine.game import Game
from engine.models import load_cards


def _fill(card, n=30):
    return [card] * n


def _by_id():
    return {c.id: c for c in load_cards("data/cards.json")}


def _fresh(player_card, opp_card=None):
    cards = _by_id()
    pawn = cards["templars_char_009"]
    game = Game.setup(
        _fill(player_card),
        _fill(opp_card or pawn),
        "A",
        "B",
        first_player=0,
        shuffle=False,
    )
    game.start_turn()
    game.active_player.energy = 10
    return game


class TestPrefixColon:
    def test_colon_prefixes(self):
        assert prefix_keywords("Opening: Draw a card.") == {"Opening"}
        assert prefix_keywords("Chain: Deal 2 damage to the enemy hero.") == {"Chain"}
        assert strip_prefix_keywords("Opening: Draw a card.") == "Draw a card."


class TestDrain:
    def test_heals_controller_on_face(self):
        cards = _by_id()
        leech = cards["neutral_char_013"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(leech), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        game.active_player.life = 20
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == leech.id)
        game.play_card(idx)
        inst = game.active_player.board[-1]
        inst.is_exhausted = False
        before = game.active_player.life
        game.attack(0, None)
        assert game.active_player.life == before + inst.current_attack


class TestVenom:
    def test_lethal_on_any_damage(self):
        cards = _by_id()
        needle = cards["neutral_char_014"]
        pawn = cards["templars_char_009"]
        game = _fresh(needle, pawn)
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == needle.id)
        game.play_card(idx)
        dummy = create_card_instance(pawn, "e1", "B")
        dummy.is_exhausted = True
        game.inactive_player.board = [dummy]
        inst = game.active_player.board[-1]
        inst.is_exhausted = False
        inst.rush_locked = False
        result = game.attack(0, 0)
        assert result["success"] is True
        assert dummy.is_alive is False


class TestRecur:
    def test_returns_at_one_health(self):
        cards = _by_id()
        sleeper = cards["neutral_char_015"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(pawn), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        cell = create_card_instance(sleeper, "s1", "B")
        game.inactive_player.board = [cell]
        cell.take_damage(1)
        assert cell.is_alive is False
        game._resolve_deaths()
        names = [c.name for c in game.inactive_player.board]
        assert "Sleeper Cell" in names
        revived = game.inactive_player.board[0]
        assert revived.current_health == 1
        assert revived.has_recur is False
        assert revived.recur_used is True


class TestStasis:
    def test_blocks_attack_until_end_of_their_turn(self):
        cards = _by_id()
        ice = cards["neutral_spell_006"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(ice), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        dummy = create_card_instance(pawn, "e1", "B")
        dummy.is_exhausted = False
        game.inactive_player.board = [dummy]
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == ice.id)
        result = game.play_card(idx, spell_target_index=0)
        assert result["success"] is True
        assert dummy.stasis is True
        assert dummy.can_attack is False
        game.end_turn()
        game.start_turn()
        assert dummy.can_attack is False
        game.end_turn()
        assert dummy.stasis is False


class TestAmplify:
    def test_boosts_spell_damage(self):
        cards = _by_id()
        booster = cards["neutral_char_016"]
        notice = cards["neutral_spell_003"]
        pawn = cards["templars_char_009"]
        game = Game.setup(
            [booster, notice] + [pawn] * 28,
            _fill(pawn),
            "A",
            "B",
            first_player=0,
            shuffle=False,
        )
        game.start_turn()
        game.active_player.energy = 10
        dummy = create_card_instance(pawn, "e1", "B")
        game.inactive_player.board = [dummy]
        bidx = next(i for i, c in enumerate(game.active_player.hand) if c.id == booster.id)
        game.play_card(bidx)
        nidx = next(i for i, c in enumerate(game.active_player.hand) if c.id == notice.id)
        game.play_card(nidx, spell_target_index=0)
        assert dummy.current_health == pawn.health - 3


class TestRecycle:
    def test_shuffles_and_draws(self):
        cards = _by_id()
        bag = cards["neutral_spell_007"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(bag), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        before_energy = game.active_player.energy
        before_hand = game.active_player.hand_size
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == bag.id)
        result = game.recycle(idx)
        assert result["success"] is True
        assert game.active_player.energy == before_energy - 1
        assert game.active_player.hand_size == before_hand
        assert any(c.id == bag.id for c in game.active_player.deck)


class TestChain:
    def test_fires_only_after_another_play(self):
        cards = _by_id()
        strike = cards["neutral_char_017"]
        pawn = cards["templars_char_009"]
        game = Game.setup(
            [pawn, strike] + [pawn] * 28,
            _fill(pawn),
            "A",
            "B",
            first_player=0,
            shuffle=False,
        )
        game.start_turn()
        game.active_player.energy = 10
        before = game.inactive_player.life
        pidx = next(i for i, c in enumerate(game.active_player.hand) if c.id == pawn.id)
        game.play_card(pidx)
        assert game.inactive_player.life == before
        sidx = next(i for i, c in enumerate(game.active_player.hand) if c.id == strike.id)
        result = game.play_card(sidx)
        assert result.get("chain")
        assert game.inactive_player.life == before - 2


class TestSplit:
    def test_choose_draw(self):
        cards = _by_id()
        brief = cards["neutral_spell_008"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(brief), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == brief.id)
        result = game.play_card(idx)
        assert result["success"] is True
        assert game.pending_split is not None
        assert len(game.pending_split["options"]) == 2
        before = game.active_player.hand_size
        chosen = game.choose_split(1)
        assert chosen["success"] is True
        assert game.pending_split is None
        assert game.active_player.hand_size == before + 1


class TestEcho:
    def test_copy_expires_at_end_of_turn(self):
        cards = _by_id()
        copy = cards["neutral_spell_009"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(copy), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == copy.id)
        result = game.play_card(idx)
        assert result.get("echo") is True
        after_play = game.active_player.hand_size
        assert after_play == 5
        game.end_turn()
        assert game.players[0].hand_size == after_play - 1


class TestExcess:
    def test_draws_when_attack_exceeds_health(self):
        cards = _by_id()
        overpen = cards["neutral_char_019"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(overpen), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == overpen.id)
        game.play_card(idx)
        dummy = create_card_instance(pawn, "e1", "B")
        dummy.take_damage(pawn.health - 1)
        dummy.is_exhausted = True
        game.inactive_player.board = [dummy]
        inst = game.active_player.board[-1]
        inst.is_exhausted = False
        before = game.active_player.hand_size
        game.attack(0, 0)
        assert game.active_player.hand_size == before + 1


class TestRetaliate:
    def test_pings_hero_once(self):
        cards = _by_id()
        trip = cards["neutral_char_020"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(pawn), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        wire = create_card_instance(trip, "t1", "B")
        wire.is_exhausted = True
        game.inactive_player.board = [wire]
        attacker = create_card_instance(pawn, "a1", "A")
        attacker.is_exhausted = False
        game.active_player.board = [attacker]
        before = game.active_player.life
        game.attack(0, 0)
        assert game.active_player.life == before - 2
        assert wire.retaliate_used is True


class TestFlash:
    def test_casts_when_drawn(self):
        cards = _by_id()
        memo = cards["neutral_spell_010"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(pawn), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.deck.insert(0, memo)
        game.end_turn()
        game.start_turn()
        game.end_turn()
        before = game.inactive_player.life
        before_hand = game.active_player.hand_size
        game.start_turn()
        assert game.inactive_player.life == before - 2
        assert game.active_player.hand_size == before_hand
        assert memo not in game.active_player.hand


class TestManifest:
    def test_enters_board_when_drawn(self):
        cards = _by_id()
        walk = cards["neutral_char_018"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(pawn), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.deck.insert(0, walk)
        game.end_turn()
        game.start_turn()
        game.end_turn()
        game.start_turn()
        names = [c.name for c in game.active_player.board]
        assert "Walk-In" in names
        assert walk not in game.active_player.hand


class TestOpening:
    def test_draws_on_first_start_turn(self):
        cards = _by_id()
        plan = cards["neutral_loc_003"]
        pawn = cards["templars_char_009"]
        game = Game.setup(
            [plan] + [pawn] * 29,
            _fill(pawn),
            "A",
            "B",
            first_player=0,
            shuffle=False,
        )
        before = game.players[0].hand_size
        game.start_turn()
        assert game.players[0].hand_size == before + 1
        assert game.players[0].opening_fired is True


class TestWard:
    def test_blocks_all_damage_without_popping(self):
        cards = _by_id()
        house = cards["neutral_spell_011"]
        pawn = cards["templars_char_009"]
        game = Game.setup(_fill(house), _fill(pawn), "A", "B", first_player=0, shuffle=False)
        game.start_turn()
        game.active_player.energy = 10
        idx = next(i for i, c in enumerate(game.active_player.hand) if c.id == house.id)
        game.play_card(idx)
        assert game.active_player.has_ward is True
        before = game.active_player.life
        assert game.active_player.direct_damage(5) == 0
        assert game.active_player.life == before
        assert game.active_player.has_ward is True
        game.end_turn()
        assert game.players[0].has_ward is False
