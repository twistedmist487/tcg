"""Generate Illuminati Board 1 campaign JSON with legal enemy decks."""

from __future__ import annotations

import json
from pathlib import Path

from engine.decks import expand_deck_entries, load_card_lookup, validate_deck

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "campaign"


def to_entries(core: list[str], size: int = 30) -> list[dict]:
    """Build a legal 30-card list: up to 2 copies, cycling core ids."""
    counts: dict[str, int] = {}
    total = 0
    i = 0
    while total < size:
        cid = core[i % len(core)]
        i += 1
        if counts.get(cid, 0) >= 2:
            # try next unused under 2
            progressed = False
            for _ in range(len(core)):
                cid2 = core[i % len(core)]
                i += 1
                if counts.get(cid2, 0) < 2:
                    cid = cid2
                    progressed = True
                    break
            if not progressed:
                # open new slot if possible by finding any core under 2
                found = False
                for c in core:
                    if counts.get(c, 0) < 2:
                        cid = c
                        found = True
                        break
                if not found:
                    raise RuntimeError(f"Need more unique cards for deck size {size}")
        counts[cid] = counts.get(cid, 0) + 1
        total += 1
    return [{"id": cid, "copies": n} for cid, n in counts.items()]


def main() -> None:
    lookup = load_card_lookup()

    street_core = [
        "neutral_char_021",
        "neutral_char_001",
        "neutral_char_007",
        "neutral_char_010",
        "neutral_char_022",
        "neutral_char_028",
        "neutral_char_003",
        "neutral_spell_003",
        "neutral_spell_018",
        "neutral_spell_013",
        "neutral_spell_022",
        "neutral_spell_028",
        "neutral_loc_001",
        "neutral_char_029",
        "neutral_char_040",
        "neutral_char_059",
        "neutral_spell_017",
        "neutral_char_033",
    ]
    archive_core = street_core + [
        "neutral_char_004",
        "neutral_spell_001",
        "neutral_spell_035",
        "neutral_spell_002",
        "neutral_loc_004",
    ]
    rooftop_core = [
        "neutral_char_010",
        "neutral_char_027",
        "neutral_char_012",
        "neutral_char_007",
        "neutral_char_003",
        "neutral_spell_003",
        "neutral_spell_029",
        "neutral_spell_038",
        "neutral_spell_031",
        "neutral_loc_006",
        "neutral_char_050",
        "neutral_char_045",
        "neutral_char_001",
        "neutral_char_022",
        "neutral_char_041",
        "neutral_spell_013",
        "neutral_spell_018",
        "neutral_char_056",
    ]
    boss_core = [
        "illuminati_char_009",
        "illuminati_char_001",
        "illuminati_char_015",
        "illuminati_char_014",
        "illuminati_spell_002",
        "illuminati_spell_013",
        "illuminati_spell_001",
        "illuminati_spell_012",
        "illuminati_loc_007",
        "neutral_char_004",
        "neutral_spell_014",
        "neutral_char_007",
        "illuminati_char_006",
        "illuminati_spell_011",
        "illuminati_char_008",
    ]
    escape_core = [
        "templars_char_009",
        "templars_char_002",
        "templars_char_004",
        "templars_char_006",
        "templars_spell_001",
        "templars_spell_004",
        "templars_spell_012",
        "templars_char_012",
        "templars_char_005",
        "neutral_char_007",
        "neutral_spell_003",
        "templars_loc_001",
        "templars_char_007",
        "templars_spell_002",
        "templars_char_015",
        "templars_char_001",
        "templars_spell_005",
        "templars_char_017",
        "neutral_char_005",
        "templars_spell_011",
    ]

    decks = {
        "street": to_entries(street_core),
        "archives": to_entries(archive_core),
        "rooftop": to_entries(rooftop_core),
        "boss": to_entries(boss_core),
        "escape": to_entries(escape_core),
    }
    for name, entries in decks.items():
        # validate as neutral or illuminati or templars
        fac = {
            "street": None,
            "archives": None,
            "rooftop": None,
            "boss": "illuminati",
            "escape": "templars",
        }[name]
        # for mixed network decks require_faction False
        if fac:
            r = validate_deck(entries, lookup, faction=fac, require_faction=True)
        else:
            # all neutral
            r = validate_deck(entries, lookup, faction="illuminati", require_faction=False)
            # manual: only neutral
            for e in expand_deck_entries(entries):
                if lookup[e].faction.value != "neutral":
                    raise SystemExit(f"{name} non-neutral {e}")
        if not r["valid"]:
            raise SystemExit(f"{name}: {r['errors']} size={r['size']}")
        print(name, "ok", r["size"])

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "illuminati").mkdir(exist_ok=True)

    index = {
        "version": 1,
        "chapters": [
            {
                "id": "illuminati",
                "name": "The Inner Circle",
                "faction": "illuminati",
                "description": "City initiation, then HQ. Learn Influence by doing.",
                "status": "available",
                "starter_board": "city",
            }
        ],
    }
    chapter = {
        "id": "illuminati",
        "name": "The Inner Circle",
        "faction": "illuminati",
        "starter_deck_id": "campaign_illuminati_city_starter",
        "boards": ["city"],
        "difficulties": {
            "normal": {"ai_default": "easy", "label": "Normal"},
            "heroic": {"ai_default": "medium", "label": "Heroic"},
        },
    }

    board = {
        "id": "city",
        "name": "City Initiation",
        "chapter_id": "illuminati",
        "start_node": "story_intro",
        "map_hint": "A rain-slick city. Your recruiter watches from the alleys.",
        "nodes": [
            {
                "id": "story_intro",
                "type": "story",
                "title": "Watched",
                "blurb": "They have been watching you.",
                "map": {"x": 0.12, "y": 0.55},
                "requires": [],
                "unlocks": ["alley_contact"],
                "story_panels": [
                    {
                        "text": "A stranger in a long coat finds you after midnight. \"We've been watching. You notice patterns others miss.\""
                    },
                    {
                        "text": "\"The organization needs new blood. Survive the city initiation, and you may claim a seat in the Inner Circle.\""
                    },
                    {
                        "text": "They press a thin deck into your hands — Network cutouts, a few Illuminati tools. \"Spend energy. Play characters. Attack. Don't die.\""
                    },
                ],
                "rewards": {"ledger_ids": ["file_watched"]},
            },
            {
                "id": "alley_contact",
                "type": "combat",
                "title": "Alley Contact",
                "blurb": "A courier wants out. Clear the street.",
                "map": {"x": 0.28, "y": 0.62},
                "requires": ["story_intro"],
                "unlocks": ["archives"],
                "ai": {
                    "difficulty": "easy",
                    "name": "Street Broker",
                    "faction": "neutral",
                },
                "player_goes_first": True,
                "shuffle": True,
                "player_deck_id": "run",
                "ai_deck": decks["street"],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "Energy grows each turn. Play your cheap characters. End turn when you're done.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_energy"]},
                "lesson_loss": "Play on curve — empty energy is wasted Influence.",
            },
            {
                "id": "archives",
                "type": "combat",
                "title": "Municipal Archives",
                "blurb": "Trades matter. Don't face race into Taunt.",
                "map": {"x": 0.44, "y": 0.48},
                "requires": ["alley_contact"],
                "unlocks": ["safe_drop"],
                "ai": {
                    "difficulty": "easy",
                    "name": "File Clerk",
                    "faction": "neutral",
                },
                "player_goes_first": True,
                "player_deck_id": "run",
                "ai_deck": decks["archives"],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "If they have Taunt, you must hit it first. Trade efficiently.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_taunt"]},
            },
            {
                "id": "safe_drop",
                "type": "safehouse",
                "title": "Safe Drop",
                "blurb": "A contact offers a small upgrade.",
                "map": {"x": 0.58, "y": 0.58},
                "requires": ["archives"],
                "unlocks": ["rooftop"],
                "safehouse": {
                    "text": "Burn a dead draw later. For now, take a tip and keep moving.",
                    "auto_continue": True,
                },
                "rewards": {"ledger_ids": ["file_safehouse"]},
            },
            {
                "id": "rooftop",
                "type": "combat",
                "title": "Rooftop Signal",
                "blurb": "Faster bodies. Spend every energy.",
                "map": {"x": 0.72, "y": 0.42},
                "requires": ["safe_drop"],
                "unlocks": ["initiation"],
                "ai": {
                    "difficulty": "easy",
                    "name": "Signal Runner",
                    "faction": "neutral",
                },
                "player_deck_id": "run",
                "ai_deck": decks["rooftop"],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "Rush and Charge ignore exhaustion rules. Respect them — or use them.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_tempo"]},
            },
            {
                "id": "initiation",
                "type": "boss",
                "title": "Initiation Duel",
                "blurb": "Prove you can think in Influence.",
                "map": {"x": 0.86, "y": 0.52},
                "requires": ["rooftop"],
                "unlocks": ["escape"],
                "ai": {
                    "difficulty": "medium",
                    "name": "Inner Auditor",
                    "faction": "illuminati",
                },
                "player_deck_id": "run",
                "ai_deck": decks["boss"],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "They will touch your hand. Discard is not defeat — it is the Illuminati lesson.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_initiation"]},
                "lesson_win": "You passed initiation. Something else is watching.",
                "lesson_loss": "Hand attack hurts. Keep draw tools and don't overcommit into silence.",
            },
            {
                "id": "escape",
                "type": "crisis",
                "title": "Traitor's Toll",
                "blurb": "Templars ambush the meeting. Survive five of your turns.",
                "map": {"x": 0.92, "y": 0.28},
                "requires": ["initiation"],
                "unlocks": [],
                "ai": {
                    "difficulty": "medium",
                    "name": "Templar Inquisitor",
                    "faction": "templars",
                },
                "player_goes_first": True,
                "player_deck_id": "run",
                "ai_deck": decks["escape"],
                "crisis": {
                    "win": "survive_turns",
                    "turns": 5,
                    "label": "Escape the ambush",
                },
                "story_panels_on_enter": [
                    {
                        "text": "Gold tabards smash the windows. The Recruiter shoves you toward the fire escape — then falls."
                    },
                    {
                        "text": "\"Run. Survive. The Lodge will find you.\" Gunfire. You are alone with five turns to live."
                    },
                ],
                "dialogue": [
                    {
                        "speaker": "You",
                        "text": "Survive five turns. Killing them is optional. Living is not.",
                    }
                ],
                "rewards": {
                    "ledger_ids": ["file_recruiter_dead", "file_escape"],
                    "flags": {"recruiter_dead": True, "board_city_complete": True},
                },
                "lesson_win": "You escaped. The Templars will not forget. HQ awaits.",
                "lesson_loss": "Stall with Taunt and healing. Face damage only if it keeps you alive.",
            },
        ],
        "ledger": {
            "file_watched": {
                "title": "File: Watched",
                "text": "You were selected. Influence begins with observation.",
            },
            "file_energy": {
                "title": "File: Energy",
                "text": "Energy grows by one each turn, max 10. Unspent energy is gone.",
            },
            "file_taunt": {
                "title": "File: Taunt",
                "text": "Taunt characters must be attacked before face or other bodies.",
            },
            "file_safehouse": {
                "title": "File: Safehouses",
                "text": "Contacts can prune decks and pass tools. Trust is currency.",
            },
            "file_tempo": {
                "title": "File: Tempo",
                "text": "Charge and Rush break exhaustion rules. Tempo is a weapon.",
            },
            "file_initiation": {
                "title": "File: Initiation",
                "text": "Illuminati pressure hands and information. Card advantage is control.",
            },
            "file_recruiter_dead": {
                "title": "File: Recruiter",
                "text": "Your first contact is dead. The organization does not stop.",
            },
            "file_escape": {
                "title": "File: Escape",
                "text": "Sometimes the win condition is the clock, not the corpse.",
            },
        },
    }

    (OUT / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    (OUT / "illuminati" / "chapter.json").write_text(
        json.dumps(chapter, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "illuminati" / "board_city.json").write_text(
        json.dumps(board, indent=2) + "\n", encoding="utf-8"
    )
    (OUT / "SCHEMA.md").write_text(
        """# Campaign schema (v1)

- `index.json` — chapter list
- `{chapter}/chapter.json` — meta, boards list, starter_deck_id
- `{chapter}/board_{id}.json` — nodes, ledger copy

## Node types

- `story` — panels only
- `combat` / `boss` — match
- `crisis` — match with `crisis.win = survive_turns`
- `safehouse` — non-combat, auto_continue allowed in v1

## Match fields

- `ai_deck`: `[{id, copies}]` or flat ids
- `player_deck_id`: `run` uses client run deck / starter
- `crisis`: `{win, turns, label}`
- `twist_ids` / twist labels (Board 2)
""",
        encoding="utf-8",
    )
    print("wrote campaign data to", OUT)


if __name__ == "__main__":
    main()
