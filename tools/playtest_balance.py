"""Phase 9 balance playtest: heuristic audit + Medium AI vs AI win rates."""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from engine.ai import AIPlayer, execute_turn
from engine.decks import build_named_deck
from engine.game import Game

FACTIONS = ("illuminati", "templars", "reptilians")
GAMES_PER_MATCHUP = 20
TURN_LIMIT = 60
DATA = Path(__file__).resolve().parent.parent / "data"

# Preset vs the natural opposing curated list. Keep this short so a full
# pass stays under a few minutes while still stressing the new verbs.
PRESET_MATCHUPS = (
    ("test_recycle_engine", "templars"),
    ("test_silence_toolbox", "reptilians"),
    ("test_network_lab", "illuminati"),
    ("test_reptilian_brood", "templars"),
    ("test_templar_aggro", "illuminati"),
    ("test_illuminati_locks", "reptilians"),
)


def heuristic_report() -> list[dict]:
    cards = json.loads((DATA / "cards.json").read_text(encoding="utf-8"))
    rows = []
    for card in cards:
        row = {
            "id": card["id"],
            "name": card["name"],
            "faction": card["faction"],
            "type": card["type"],
            "cost": card["cost"],
            "flags": [],
        }
        if card["type"] == "Character":
            total = card["attack"] + card["health"]
            expected = card["cost"] + 1
            row["attack"] = card["attack"]
            row["health"] = card["health"]
            row["delta"] = total - expected
            row["ability"] = card.get("ability", "")
            if total < card["cost"]:
                row["flags"].append("understat")
            elif total > card["cost"] + 2:
                row["flags"].append("overstat")
        elif card["type"] == "Spell":
            row["effect"] = card.get("effect", "")
        else:
            row["effect"] = card.get("effect", "")
            if card["cost"] < 4:
                row["flags"].append("cheap-location")
        rows.append(row)
    return rows


def _faction_of(deck_id: str) -> str:
    if deck_id in FACTIONS:
        return deck_id
    if "illuminati" in deck_id:
        return "illuminati"
    if "templar" in deck_id:
        return "templars"
    if "reptilian" in deck_id:
        return "reptilians"
    return "illuminati"


def play_game(deck1_id: str, deck2_id: str) -> dict:
    """Play one Medium-AI game between two named decks (faction or preset id)."""
    deck1 = build_named_deck(deck1_id)
    deck2 = build_named_deck(deck2_id)
    game = Game.setup(deck1, deck2, deck1_id, deck2_id)
    ai1 = AIPlayer(name=deck1_id, faction=_faction_of(deck1_id), difficulty="medium")
    ai2 = AIPlayer(name=deck2_id, faction=_faction_of(deck2_id), difficulty="medium")
    ais = {deck1_id: ai1, deck2_id: ai2}

    for _ in range(TURN_LIMIT):
        if game.is_over:
            break
        game.start_turn()
        if game.is_over:
            break
        execute_turn(game, ais[game.active_player.name])

    return {
        "f1": deck1_id,
        "f2": deck2_id,
        "winner": game.winner,
        "turns": game.turn_number,
        "timed_out": not game.is_over,
        "life": {p.name: p.life for p in game.players},
    }


def run_playtests(
    matchups: list[tuple[str, str]],
    games_per: int = GAMES_PER_MATCHUP,
) -> dict:
    wins: dict[tuple[str, str], Counter] = defaultdict(Counter)
    turns: dict[tuple[str, str], list[int]] = defaultdict(list)
    timeouts = 0

    for f1, f2 in matchups:
        for _ in range(games_per):
            result = play_game(f1, f2)
            key = (f1, f2)
            if result["timed_out"]:
                wins[key]["timeout"] += 1
                timeouts += 1
            elif result["winner"] == f1:
                wins[key][f1] += 1
            elif result["winner"] == f2:
                wins[key][f2] += 1
            else:
                wins[key]["unknown"] += 1
            turns[key].append(result["turns"])

    return {"wins": wins, "turns": turns, "timeouts": timeouts}


def _print_matchups(title: str, results: dict, games_per: int) -> None:
    print(f"\n=== {title} ({games_per} games / matchup) ===")
    for (f1, f2), counts in results["wins"].items():
        n = games_per
        f1w = counts[f1]
        f2w = counts[f2]
        to = counts["timeout"]
        avg_turns = sum(results["turns"][(f1, f2)]) / n
        print(
            f"  {f1:24} vs {f2:16}  {f1w:2}/{n} - {f2w:2}/{n}  "
            f"timeouts={to}  avg_turns={avg_turns:.1f}"
        )
    print(f"timeouts: {results['timeouts']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Medium AI vs AI balance pass")
    parser.add_argument("--games", type=int, default=GAMES_PER_MATCHUP)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--skip-presets", action="store_true")
    args = parser.parse_args()

    random.seed(args.seed)
    print("=== HEURISTIC FLAGS ===")
    rows = heuristic_report()
    flagged = [r for r in rows if r["flags"]]
    print(f"{len(flagged)} of {len(rows)} cards flagged")
    for r in flagged:
        extra = r.get("delta", r.get("effect", ""))
        print(f"  {r['id']:28} {r['name']:28} cost={r['cost']} flags={r['flags']} {extra}")

    print("\n=== CHARACTER DELTAS (stat - (cost+1)) ===")
    chars = [r for r in rows if r["type"] == "Character"]
    chars.sort(key=lambda r: r["delta"])
    for r in chars:
        print(
            f"  {r['delta']:+d}  cost={r['cost']} {r['attack']}/{r['health']}  "
            f"{r['name']:28} {r['ability'][:55]}"
        )

    faction_matchups = [(a, b) for a in FACTIONS for b in FACTIONS if a != b]
    faction_results = run_playtests(faction_matchups, args.games)
    _print_matchups("FACTION AI vs AI", faction_results, args.games)

    faction_wins: Counter = Counter()
    faction_games: Counter = Counter()
    for (f1, f2), counts in faction_results["wins"].items():
        faction_wins[f1] += counts[f1]
        faction_wins[f2] += counts[f2]
        faction_games[f1] += args.games
        faction_games[f2] += args.games

    print("\n=== FACTION WIN RATES (as either seat) ===")
    for f in FACTIONS:
        n = faction_games[f]
        wr = 100.0 * faction_wins[f] / max(1, n)
        print(f"  {f:12} {faction_wins[f]}/{n}  (~{wr:.0f}%)")
    print(f"timeouts: {faction_results['timeouts']}")

    if not args.skip_presets:
        preset_results = run_playtests(list(PRESET_MATCHUPS), args.games)
        _print_matchups("PRESET vs CURATED", preset_results, args.games)


if __name__ == "__main__":
    main()
