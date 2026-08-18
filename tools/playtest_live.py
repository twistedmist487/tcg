"""Play tutorial-shaped and preset-vs-preset matches; report failures."""

from __future__ import annotations

import traceback
from collections import Counter

from engine.ai import AIPlayer, execute_turn
from engine.decks import build_named_deck, load_encounters, load_presets
from engine.game import Game
from engine.decks import build_deck, load_card_lookup


def play_match(deck1, deck2, name1, name2, faction1, faction2, *, first=0, max_turns=80):
    notes: list[str] = []
    game = Game.setup(
        deck1,
        deck2,
        name1,
        name2,
        first_player=first,
        shuffle=True,
        player1_faction=faction1,
        player2_faction=faction2,
    )
    game.mulligan(name1, [])
    game.mulligan(name2, [])
    ai1 = AIPlayer(name=name1, faction=faction1, difficulty="medium")
    ai2 = AIPlayer(name=name2, faction=faction2, difficulty="medium")
    agents = {name1: ai1, name2: ai2}
    failed = 0
    try:
        while not game.is_over and game.turn_number < max_turns:
            start = game.start_turn()
            if not start.get("success"):
                notes.append(f"start_turn failed t{game.turn_number}: {start}")
                break
            if game.is_over:
                break
            actor = game.active_player.name
            results = execute_turn(game, agents[actor])
            for step in results:
                result = step.get("result") or {}
                if result.get("success") is False:
                    failed += 1
                    notes.append(
                        f"{actor} {step.get('action')} failed: "
                        f"{result.get('error') or result.get('card') or ''} "
                        f"{(result.get('effect') or {}).get('description') or result}"
                    )
            if game.turn_started and not game.is_over:
                end = game.end_turn()
                if end.get("success") is False:
                    notes.append(f"end_turn failed: {end}")
                    break
    except Exception as exc:
        notes.append(f"CRASH: {exc}")
        notes.append(traceback.format_exc().splitlines()[-1])
    return {
        "turns": game.turn_number,
        "winner": game.winner,
        "over": game.is_over,
        "failed_actions": failed,
        "notes": notes[:12],
        "life": {p.name: p.life for p in game.players},
    }


def main() -> int:
    cards = load_card_lookup()
    encounters = load_encounters()
    problems = 0

    print("=== Tutorial decks (unshuffled, then shuffled AI play) ===")
    tutorial = encounters["tutorial"]
    pdeck = build_deck(tutorial["player_deck"], cards)
    adeck = build_deck(tutorial["ai_deck"], cards)
    result = play_match(
        pdeck,
        adeck,
        "Recruit",
        "The Recruiter",
        tutorial["player_faction"],
        tutorial["ai_faction"],
        first=0,
    )
    print(
        f"  tutorial AI-vs-AI: over={result['over']} winner={result['winner']} "
        f"turns={result['turns']} fails={result['failed_actions']} life={result['life']}"
    )
    for note in result["notes"]:
        print(f"    ! {note}")
        problems += 1

    print("\n=== Preset vs preset ===")
    presets = load_presets()
    pairings = [
        ("test_templar_aggro", "test_reptilian_swarm"),
        ("test_templar_control", "test_illuminati_control"),
        ("test_network_lab", "test_reptilian_swarm"),
        ("test_illuminati_control", "test_templar_aggro"),
        ("test_reptilian_swarm", "test_templar_control"),
        ("test_silence_toolbox", "test_recycle_engine"),
        ("test_illuminati_locks", "test_reptilian_brood"),
        ("test_templar_oath", "test_illuminati_locks"),
    ]
    for a, b in pairings:
        pa = next(p for p in presets if p["id"] == a)
        pb = next(p for p in presets if p["id"] == b)
        result = play_match(
            build_named_deck(a),
            build_named_deck(b),
            "P1",
            "P2",
            pa["faction"],
            pb["faction"],
        )
        flag = "OK" if result["over"] and not result["notes"] else "ISSUE"
        if not result["over"]:
            problems += 1
        problems += len(result["notes"])
        print(
            f"  {flag} {a} vs {b}: winner={result['winner']} turns={result['turns']} "
            f"fails={result['failed_actions']} life={result['life']}"
        )
        for note in result["notes"]:
            print(f"    ! {note}")

    print(f"\nProblems logged: {problems}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
