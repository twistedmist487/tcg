"""Phase 7 balance playtest: heuristic audit + AI vs AI win rates."""

from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from engine.ai import AIPlayer, execute_turn
from engine.game import Game
from server.session import _load_deck

FACTIONS = ("illuminati", "templars", "reptilians")
GAMES_PER_MATCHUP = 20
TURN_LIMIT = 60
DATA = Path(__file__).resolve().parent.parent / "data"


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


def play_game(f1: str, f2: str) -> dict:
    deck1 = _load_deck(f1)
    deck2 = _load_deck(f2)
    game = Game.setup(deck1, deck2, f1, f2)
    ai1 = AIPlayer(name=f1, faction=f1, aggression=0.6)
    ai2 = AIPlayer(name=f2, faction=f2, aggression=0.6)
    ais = {f1: ai1, f2: ai2}

    for _ in range(TURN_LIMIT):
        if game.is_over:
            break
        game.start_turn()
        if game.is_over:
            break
        execute_turn(game, ais[game.active_player.name])

    return {
        "f1": f1,
        "f2": f2,
        "winner": game.winner,
        "turns": game.turn_number,
        "timed_out": not game.is_over,
        "life": {p.name: p.life for p in game.players},
    }


def run_playtests(games_per: int = GAMES_PER_MATCHUP) -> dict:
    matchups = [(a, b) for a in FACTIONS for b in FACTIONS if a != b]
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


def main() -> None:
    random.seed(7)
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

    print(f"\n=== AI vs AI ({GAMES_PER_MATCHUP} games / matchup) ===")
    results = run_playtests()
    faction_wins: Counter = Counter()
    faction_games: Counter = Counter()
    for (f1, f2), counts in results["wins"].items():
        n = GAMES_PER_MATCHUP
        f1w = counts[f1]
        f2w = counts[f2]
        to = counts["timeout"]
        faction_wins[f1] += f1w
        faction_wins[f2] += f2w
        faction_games[f1] += n
        faction_games[f2] += n
        avg_turns = sum(results["turns"][(f1, f2)]) / n
        print(
            f"  {f1:12} vs {f2:12}  {f1w:2}/{n} - {f2w:2}/{n}  "
            f"timeouts={to}  avg_turns={avg_turns:.1f}"
        )

    print("\n=== FACTION WIN RATES (as either seat) ===")
    for f in FACTIONS:
        wr = 100.0 * faction_wins[f] / max(1, faction_games[f] - results["timeouts"] // 3)
        print(f"  {f:12} {faction_wins[f]}/{faction_games[f]}  (~{wr:.0f}%)")
    print(f"timeouts: {results['timeouts']}")


if __name__ == "__main__":
    main()
