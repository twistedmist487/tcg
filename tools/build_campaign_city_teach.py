"""Rebuild Illuminati City board with short AI life + scripted teach nodes."""

from __future__ import annotations

import json
from pathlib import Path

from engine.decks import load_card_lookup, validate_deck

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "campaign" / "illuminati" / "board_city.json"


def flat30(
    *priority: str,
    filler: list[str] | None = None,
    faction: str | None = "illuminati",
    max_network: int = 12,
) -> list[str]:
    """Build ordered 30-card list (max 2 copies). Optional faction Network cap."""
    lookup = load_card_lookup()
    filler = filler or []
    counts: dict[str, int] = {}
    out: list[str] = []
    network = 0

    def is_net(cid: str) -> bool:
        return lookup[cid].faction.value == "neutral"

    def can_add(cid: str) -> bool:
        if counts.get(cid, 0) >= 2:
            return False
        if faction and is_net(cid) and network >= max_network:
            return False
        if faction and lookup[cid].faction.value not in (faction, "neutral"):
            return False
        return True

    def add(cid: str) -> bool:
        nonlocal network
        if not can_add(cid):
            return False
        counts[cid] = counts.get(cid, 0) + 1
        out.append(cid)
        if is_net(cid):
            network += 1
        return True

    for cid in priority:
        if not add(cid):
            raise RuntimeError(f"cannot place priority card {cid}")
    pool = list(dict.fromkeys([*priority, *filler]))
    # Prefer on-faction filler when network capped
    i = 0
    guard = 0
    while len(out) < 30:
        guard += 1
        if guard > 5000:
            raise RuntimeError(f"cannot fill deck ({len(out)}/30, net={network})")
        cid = pool[i % len(pool)]
        i += 1
        if add(cid):
            continue
        progressed = False
        for c in pool:
            if add(c):
                progressed = True
                break
        if not progressed:
            raise RuntimeError(f"stuck filling deck at {len(out)} net={network}")
    return out[:30]


def entries_from_flat(ids: list[str]) -> list[dict]:
    counts: dict[str, int] = {}
    for i in ids:
        counts[i] = counts.get(i, 0) + 1
    return [{"id": k, "copies": v} for k, v in counts.items()]


NET_FILL = [
    "neutral_char_021",
    "neutral_char_001",
    "neutral_char_029",
    "neutral_char_059",
    "neutral_spell_028",
    "neutral_spell_018",
    "neutral_spell_022",
    "neutral_spell_013",
    "neutral_char_040",
    "neutral_char_033",
    "neutral_loc_010",
    "neutral_char_032",
    "neutral_spell_017",
    "neutral_char_050",
    "neutral_spell_027",
    "neutral_char_023",
]

ILL_FILL = [
    "illuminati_char_002",
    "illuminati_char_004",
    "illuminati_char_009",
    "illuminati_spell_011",
    "illuminati_spell_008",
    "illuminati_spell_004",
    "illuminati_spell_009",
    "illuminati_char_006",
    "illuminati_loc_006",
    "illuminati_char_015",
    "neutral_char_007",
    "neutral_char_022",
    "neutral_char_001",
    "neutral_char_028",
    "neutral_spell_003",
    "neutral_spell_022",
]


def main() -> None:
    lookup = load_card_lookup()

    # --- Alley: energy / play / exhaust / face ---
    alley_p = flat30(
        "illuminati_char_009",  # Lobbyist (Taunt 1)
        "neutral_char_001",  # Freelance 2/2
        "neutral_spell_003",  # Burn Notice
        "illuminati_spell_009",  # Bailout
        "neutral_char_028",  # Safehouse Cook
        "illuminati_char_002",
        "illuminati_char_004",
        filler=ILL_FILL + NET_FILL,
        faction="illuminati",
    )
    alley_ai = flat30(
        "neutral_char_021",  # Cutout 1/1
        "neutral_char_029",  # Desk Clerk
        "neutral_char_001",
        "neutral_spell_018",
        "neutral_char_059",
        filler=NET_FILL,
        faction=None,
    )

    # --- Archives: Taunt must-attack ---
    arch_p = flat30(
        "illuminati_char_009",
        "illuminati_char_009",
        "neutral_spell_003",
        "neutral_spell_003",
        "illuminati_char_004",
        "illuminati_spell_004",
        "neutral_char_001",
        filler=ILL_FILL + NET_FILL,
        faction="illuminati",
    )
    arch_ai = flat30(
        "neutral_char_021",  # Cutout early
        "neutral_char_029",
        "neutral_char_007",  # Contract Guard Taunt
        "neutral_char_022",  # Night Watchman Taunt
        "neutral_spell_013",
        filler=NET_FILL,
        faction=None,
    )

    # --- Rooftop: Rush / Charge ---
    roof_p = flat30(
        "neutral_char_010",  # Street Runner Rush
        "neutral_char_041",  # Alley Runner Rush
        "illuminati_char_009",
        "neutral_spell_003",
        "illuminati_char_004",
        "neutral_char_045",  # Late Charge
        filler=ILL_FILL + NET_FILL,
        faction="illuminati",
    )
    roof_ai = flat30(
        "neutral_char_021",
        "neutral_char_001",
        "neutral_char_007",
        "neutral_spell_018",
        "neutral_char_003",
        filler=NET_FILL,
        faction=None,
    )

    # --- Initiation: hand attack / discard ---
    init_p = flat30(
        "illuminati_char_001",  # Shadow Broker
        "illuminati_spell_011",  # Dead Letter
        "illuminati_char_015",  # Ghost Clerk
        "illuminati_char_009",
        "illuminati_spell_002",  # Black Budget
        "neutral_char_004",  # Double Agent
        "illuminati_spell_008",
        filler=ILL_FILL + NET_FILL,
        faction="illuminati",
    )
    init_ai = flat30(
        "illuminati_char_006",
        "illuminati_char_009",
        "illuminati_char_001",
        "illuminati_spell_011",
        "neutral_char_007",
        "illuminati_spell_001",
        filler=ILL_FILL
        + [
            "illuminati_char_014",
            "illuminati_spell_013",
            "illuminati_loc_007",
            "neutral_spell_014",
            "illuminati_char_008",
            "illuminati_char_002",
            "illuminati_char_004",
            "illuminati_spell_009",
            "illuminati_spell_004",
            "illuminati_loc_006",
        ],
        faction="illuminati",
    )

    # --- Escape crisis: walls, survive ---
    esc_p = flat30(
        "illuminati_char_009",
        "neutral_char_007",
        "neutral_char_022",
        "illuminati_spell_009",
        "neutral_spell_022",
        "illuminati_char_002",
        filler=ILL_FILL + NET_FILL,
        faction="illuminati",
    )
    esc_ai = flat30(
        "templars_char_009",
        "templars_char_002",
        "templars_char_012",
        "templars_spell_001",
        "templars_char_006",
        "templars_spell_004",
        filler=[
            "templars_char_004",
            "templars_char_005",
            "templars_char_007",
            "templars_spell_012",
            "templars_loc_001",
            "neutral_char_007",
            "neutral_spell_003",
            "templars_char_015",
            "templars_char_001",
            "templars_spell_005",
            "templars_char_017",
            "neutral_char_005",
            "templars_spell_011",
            "templars_spell_002",
            "templars_char_013",
            "templars_spell_003",
        ],
        faction="templars",
    )

    for name, deck, fac in [
        ("alley_p", alley_p, "illuminati"),
        ("arch_p", arch_p, "illuminati"),
        ("roof_p", roof_p, "illuminati"),
        ("init_p", init_p, "illuminati"),
        ("esc_p", esc_p, "illuminati"),
        ("alley_ai", alley_ai, None),
        ("arch_ai", arch_ai, None),
        ("roof_ai", roof_ai, None),
        ("init_ai", init_ai, "illuminati"),
        ("esc_ai", esc_ai, "templars"),
    ]:
        ents = entries_from_flat(deck)
        if fac:
            r = validate_deck(ents, lookup, faction=fac, require_faction=True)
        else:
            r = validate_deck(ents, lookup, faction="illuminati", require_faction=False)
            for cid in deck:
                if lookup[cid].faction.value != "neutral":
                    raise SystemExit(f"{name} non-neutral {cid}")
        if not r["valid"]:
            raise SystemExit(f"{name}: {r['errors']}")
        print(name, "ok")

    board = {
        "id": "city",
        "name": "City Initiation",
        "chapter_id": "illuminati",
        "start_node": "story_intro",
        "map_hint": "Short fights. New verbs are scripted when they appear.",
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
                        "text": "\"The city initiation is short. Low stakes. We script the first lessons so you learn by doing — not by dying at 30 life.\""
                    },
                    {
                        "text": "They press a thin deck into your hands. \"Energy. Play. Attack. End turn. Follow the prompts.\""
                    },
                ],
                "rewards": {"ledger_ids": ["file_watched"]},
            },
            {
                "id": "alley_contact",
                "type": "combat",
                "title": "Alley Contact",
                "blurb": "Learn the loop. AI starts at 10 life.",
                "map": {"x": 0.28, "y": 0.62},
                "requires": ["story_intro"],
                "unlocks": ["archives"],
                "ai": {"difficulty": "easy", "name": "Street Broker", "faction": "neutral"},
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 10,
                "player_deck": alley_p,
                "ai_deck": alley_ai,
                "teach": True,
                "steps": [
                    {
                        "id": "welcome",
                        "title": "Energy and play",
                        "text": "You start with 1 energy. Play Lobbyist (cost 1) from hand onto your board.",
                        "require": "play_named:Lobbyist",
                        "highlight": "Lobbyist",
                    },
                    {
                        "id": "exhaustion",
                        "title": "Exhausted",
                        "text": "New characters usually cannot attack this turn. Click End Turn and let the Broker act.",
                        "require": "end_turn",
                    },
                    {
                        "id": "attack",
                        "title": "Attack",
                        "text": "Your character is ready. Attack the enemy board or their hero (face). Finish them — they only have 10 life.",
                        "require": "attack",
                    },
                    {
                        "id": "free",
                        "title": "Close it out",
                        "text": "Spend energy, attack, end turn. Reduce Street Broker to 0.",
                        "require": "free",
                    },
                ],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "Energy grows each turn. Unspent energy is gone. Don't hoard.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_energy"]},
                "lesson_loss": "Play on curve and poke face — they only had 10 life.",
            },
            {
                "id": "archives",
                "type": "combat",
                "title": "Municipal Archives",
                "blurb": "Taunt walls. AI at 12 life.",
                "map": {"x": 0.44, "y": 0.48},
                "requires": ["alley_contact"],
                "unlocks": ["safe_drop"],
                "ai": {"difficulty": "easy", "name": "File Clerk", "faction": "neutral"},
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 12,
                "player_deck": arch_p,
                "ai_deck": arch_ai,
                "teach": True,
                "steps": [
                    {
                        "id": "develop",
                        "title": "Build and pass",
                        "text": "Play cheap characters and End Turn. The Clerk will eventually drop Taunt (Contract Guard / Night Watchman).",
                        "require": "end_turn",
                    },
                    {
                        "id": "taunt",
                        "title": "Taunt",
                        "text": "When an enemy has Taunt, you must attack it before face. Hit the outlined Taunt. Burn Notice can snipe small walls.",
                        "require": "attack_taunt",
                    },
                    {
                        "id": "free",
                        "title": "Clear the archive",
                        "text": "Break Taunt, then finish the Clerk — only 12 life.",
                        "require": "free",
                    },
                ],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "Taunt is a wall. Respect it or remove it.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_taunt"]},
            },
            {
                "id": "safe_drop",
                "type": "safehouse",
                "title": "Safe Drop",
                "blurb": "A contact offers a breath.",
                "map": {"x": 0.58, "y": 0.58},
                "requires": ["archives"],
                "unlocks": ["rooftop"],
                "safehouse": {
                    "text": "Next lesson is tempo — Rush and Charge ignore the usual wait.",
                    "auto_continue": True,
                },
                "rewards": {"ledger_ids": ["file_safehouse"]},
            },
            {
                "id": "rooftop",
                "type": "combat",
                "title": "Rooftop Signal",
                "blurb": "Rush hits characters now. AI at 12 life.",
                "map": {"x": 0.72, "y": 0.42},
                "requires": ["safe_drop"],
                "unlocks": ["initiation"],
                "ai": {"difficulty": "easy", "name": "Signal Runner", "faction": "neutral"},
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 12,
                "player_deck": roof_p,
                "ai_deck": roof_ai,
                "teach": True,
                "steps": [
                    {
                        "id": "rush",
                        "title": "Rush",
                        "text": "Play Street Runner (Rush). Rush can attack characters the turn it is played — but not the hero.",
                        "require": "play_named:Street Runner",
                        "highlight": "Street Runner",
                    },
                    {
                        "id": "rush-attack",
                        "title": "Swing now",
                        "text": "Attack an enemy character with Street Runner this turn.",
                        "require": "attack",
                    },
                    {
                        "id": "free",
                        "title": "Take the roof",
                        "text": "Use Rush/Charge tools and finish at 12 life.",
                        "require": "free",
                    },
                ],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "Rush hits bodies now. Charge can hit face the turn it lands.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_tempo"]},
            },
            {
                "id": "initiation",
                "type": "boss",
                "title": "Initiation Duel",
                "blurb": "Hand attack. AI at 14 life.",
                "map": {"x": 0.86, "y": 0.52},
                "requires": ["rooftop"],
                "unlocks": ["escape"],
                "ai": {
                    "difficulty": "medium",
                    "name": "Inner Auditor",
                    "faction": "illuminati",
                },
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 14,
                "player_deck": init_p,
                "ai_deck": init_ai,
                "teach": True,
                "steps": [
                    {
                        "id": "hand",
                        "title": "Influence",
                        "text": "Play Shadow Broker or Dead Letter when you can afford it — look at their hand and force a discard.",
                        "require": "play_named:Shadow Broker",
                        "highlight": "Shadow Broker",
                    },
                    {
                        "id": "free",
                        "title": "Pass initiation",
                        "text": "Keep pressing. Auditor is on 14 life. Card advantage is control.",
                        "require": "free",
                    },
                ],
                "dialogue": [
                    {
                        "speaker": "Recruiter",
                        "text": "Illuminati win by starving options. Discard is a knife.",
                    }
                ],
                "rewards": {"ledger_ids": ["file_initiation"]},
                "lesson_win": "You passed initiation. Something else is watching.",
                "lesson_loss": "Hand attack hurts both ways. Keep draw and don't overextend into silence.",
            },
            {
                "id": "escape",
                "type": "crisis",
                "title": "Traitor's Toll",
                "blurb": "Survive 5 of your turns. AI at 18 life (you do not need the kill).",
                "map": {"x": 0.92, "y": 0.28},
                "requires": ["initiation"],
                "unlocks": [],
                "ai": {
                    "difficulty": "medium",
                    "name": "Templar Inquisitor",
                    "faction": "templars",
                },
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 18,
                "player_deck": esc_p,
                "ai_deck": esc_ai,
                "crisis": {
                    "win": "survive_turns",
                    "turns": 5,
                    "label": "Escape the ambush",
                },
                "teach": True,
                "steps": [
                    {
                        "id": "survive",
                        "title": "Crisis: Survive",
                        "text": "Win condition is the clock — survive 5 of your turns. Taunt and heals first. Killing them is optional.",
                        "require": "free",
                    }
                ],
                "story_panels_on_enter": [
                    {
                        "text": "Gold tabards smash the windows. The Recruiter shoves you toward the fire escape — then falls."
                    },
                    {
                        "text": "\"Run. Survive. The Lodge will find you.\" Five turns. Live."
                    },
                ],
                "rewards": {
                    "ledger_ids": ["file_recruiter_dead", "file_escape"],
                    "flags": {"recruiter_dead": True, "board_city_complete": True},
                    "next_board": "hq",
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
                "text": "Contacts reset the pace. Trust is currency.",
            },
            "file_tempo": {
                "title": "File: Tempo",
                "text": "Rush hits characters immediately. Charge can hit face the turn it is played.",
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

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(board, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
