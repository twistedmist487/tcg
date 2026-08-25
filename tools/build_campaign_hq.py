"""Build Illuminati HQ board (M3): train → breach → reverse siege → boss."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.build_campaign_city_teach import (  # noqa: E402
    ILL_FILL,
    NET_FILL,
    flat30,
    validate_deck,
    load_card_lookup,
    entries_from_flat,
)

OUT = ROOT / "data" / "campaign" / "illuminati" / "board_hq.json"
CHAPTER = ROOT / "data" / "campaign" / "illuminati" / "chapter.json"

TEMP_FILL = [
    "templars_char_009",
    "templars_char_002",
    "templars_char_006",
    "templars_char_004",
    "templars_char_007",
    "templars_char_015",
    "templars_char_001",
    "templars_spell_001",
    "templars_spell_003",
    "templars_spell_004",
    "templars_spell_005",
    "templars_spell_011",
    "templars_spell_012",
    "templars_loc_001",
    "templars_char_014",
    "templars_char_018",
    "neutral_char_005",
    "neutral_char_007",
]


def check(name: str, deck: list[str], fac: str | None) -> None:
    lookup = load_card_lookup()
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


def main() -> None:
    # Shared player shell for HQ (teach cards early in hand)
    player = flat30(
        "illuminati_char_009",
        "illuminati_spell_001",  # Media Blackout
        "illuminati_char_001",  # Shadow Broker
        "illuminati_spell_012",  # Quiet Extradition
        "illuminati_spell_011",
        "neutral_char_007",
        "illuminati_char_015",
        "illuminati_spell_002",
        filler=ILL_FILL + NET_FILL,
        faction="illuminati",
    )

    # Training AI: silence-focused
    ai_silence = flat30(
        "neutral_char_021",
        "illuminati_spell_001",  # Media Blackout — but AI faction illuminati
        "illuminati_char_018",
        "illuminati_spell_010",
        "neutral_char_007",
        filler=ILL_FILL + ["illuminati_char_012", "illuminati_spell_014", "neutral_spell_014"],
        faction="illuminati",
    )
    # Training AI: discard
    ai_discard = flat30(
        "illuminati_char_006",
        "illuminati_char_001",
        "illuminati_spell_013",
        "illuminati_char_014",
        "illuminati_spell_002",
        filler=ILL_FILL + ["illuminati_spell_014", "neutral_char_004"],
        faction="illuminati",
    )
    # Training AI: bounce / soft lock
    ai_bounce = flat30(
        "illuminati_spell_012",
        "illuminati_char_016",
        "illuminati_char_008",
        "neutral_spell_015",
        "illuminati_char_003",
        filler=ILL_FILL + NET_FILL,
        faction="illuminati",
    )

    # Reverse Templar variants (tougher, short life still)
    rev_a = flat30(
        "templars_char_009",
        "templars_char_002",
        "templars_spell_001",
        "templars_char_004",
        "templars_spell_004",
        filler=TEMP_FILL,
        faction="templars",
    )
    rev_b = flat30(
        "templars_char_002",
        "templars_char_007",
        "templars_spell_012",
        "templars_char_006",
        "templars_loc_001",
        filler=TEMP_FILL,
        faction="templars",
    )
    rev_c = flat30(
        "templars_char_014",
        "templars_char_018",
        "templars_spell_010",
        "templars_char_011",
        "templars_spell_006",
        filler=TEMP_FILL,
        faction="templars",
    )
    boss = flat30(
        "templars_char_010",  # Grand Master
        "templars_char_014",
        "templars_char_018",
        "templars_spell_010",
        "templars_spell_006",
        "templars_char_007",
        "templars_loc_004",
        "templars_spell_002",
        filler=TEMP_FILL,
        faction="templars",
    )

    for n, d, f in [
        ("player", player, "illuminati"),
        ("ai_silence", ai_silence, "illuminati"),
        ("ai_discard", ai_discard, "illuminati"),
        ("ai_bounce", ai_bounce, "illuminati"),
        ("rev_a", rev_a, "templars"),
        ("rev_b", rev_b, "templars"),
        ("rev_c", rev_c, "templars"),
        ("boss", boss, "templars"),
    ]:
        check(n, d, f)

    fortitude = {
        "id": "templar_fortitude",
        "label": "Righteous Fortitude",
        "description": "Enemy characters enter play with +1 Health.",
        "match_modifiers": {
            "enemy_character_health_bonus": 1,
        },
    }

    def reverse_block(title: str, blurb: str, ai_name: str, deck: list[str], life: int) -> dict:
        return {
            "title": title,
            "blurb": blurb,
            "type": "combat",
            "ai": {"difficulty": "medium", "name": ai_name, "faction": "templars"},
            "ai_starting_life": life,
            "player_goes_first": True,
            "shuffle": False,
            "player_deck": player,
            "ai_deck": deck,
            "twist": fortitude,
            "dialogue": [
                {
                    "speaker": "Ops",
                    "text": "Twist active: Templar bodies are tougher (+1 Health on enter).",
                }
            ],
        }

    board = {
        "id": "hq",
        "name": "Illuminati HQ",
        "chapter_id": "illuminati",
        "start_node": "hq_arrival",
        "map_hint": "Train in the sanctum. When the breach hits, fight back out under Fortitude.",
        "reverse_order": ["train_bounce", "train_discard", "train_silence"],
        "boss_node": "grandmaster",
        "nodes": [
            {
                "id": "hq_arrival",
                "type": "story",
                "title": "The Lodge",
                "blurb": "You are pulled into HQ for refined training.",
                "map": {"x": 0.1, "y": 0.5},
                "requires": [],
                "unlocks": ["train_silence"],
                "story_panels": [
                    {
                        "text": "Below the city, marble and server racks share the same halls. Someone pins a new clearance badge to your coat."
                    },
                    {
                        "text": "\"City lessons were the street. Here we teach Influence properly — silence, discard, denial. Then you earn the right to leave.\""
                    },
                ],
                "rewards": {"ledger_ids": ["file_hq_arrival"]},
            },
            {
                "id": "train_silence",
                "type": "combat",
                "title": "Mute Chamber",
                "blurb": "Silence strips keywords. AI at 12 life.",
                "map": {"x": 0.28, "y": 0.38},
                "requires": ["hq_arrival"],
                "unlocks": ["train_discard"],
                "ai": {
                    "difficulty": "easy",
                    "name": "Quiet Auditor",
                    "faction": "illuminati",
                },
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 12,
                "player_deck": player,
                "ai_deck": ai_silence,
                "teach": True,
                "steps": [
                    {
                        "id": "silence",
                        "title": "Silence",
                        "text": "Media Blackout and mute effects strip Taunt/Stealth/abilities. Play Media Blackout when you can afford it, or win through board.",
                        "require": "play_named:Media Blackout",
                    },
                    {
                        "id": "free",
                        "title": "Clear the chamber",
                        "text": "Finish the Auditor — 12 life.",
                        "require": "free",
                    },
                ],
                "rewards": {"ledger_ids": ["file_silence"]},
                "reverse": reverse_block(
                    "Mute Chamber — Breached",
                    "Templars in the silence lab. Fortitude is up.",
                    "Chapel Interdictor",
                    rev_c,
                    14,
                ),
            },
            {
                "id": "train_discard",
                "type": "combat",
                "title": "Burn Room",
                "blurb": "Discard and hand pressure. AI at 12 life.",
                "map": {"x": 0.46, "y": 0.55},
                "requires": ["train_silence"],
                "unlocks": ["train_bounce"],
                "ai": {
                    "difficulty": "easy",
                    "name": "Ash Clerk",
                    "faction": "illuminati",
                },
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 12,
                "player_deck": player,
                "ai_deck": ai_discard,
                "teach": True,
                "steps": [
                    {
                        "id": "discard",
                        "title": "Discard",
                        "text": "Shadow Broker and Leak tools attack the hand. Play Shadow Broker when you can.",
                        "require": "play_named:Shadow Broker",
                    },
                    {
                        "id": "free",
                        "title": "Empty the burn room",
                        "text": "Pressure life — Ash Clerk is on 12.",
                        "require": "free",
                    },
                ],
                "rewards": {"ledger_ids": ["file_discard"]},
                "reverse": reverse_block(
                    "Burn Room — Breached",
                    "Templar purge teams torch the archives.",
                    "Relic Arsonist",
                    rev_b,
                    14,
                ),
            },
            {
                "id": "train_bounce",
                "type": "combat",
                "title": "Soft Exile Wing",
                "blurb": "Bounce and tax. AI at 12 life.",
                "map": {"x": 0.64, "y": 0.4},
                "requires": ["train_discard"],
                "unlocks": ["hq_armory"],
                "ai": {
                    "difficulty": "medium",
                    "name": "Door Clerk",
                    "faction": "illuminati",
                },
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 12,
                "player_deck": player,
                "ai_deck": ai_bounce,
                "teach": True,
                "steps": [
                    {
                        "id": "bounce",
                        "title": "Bounce",
                        "text": "Quiet Extradition returns small enemies to hand. Tempo reset — then go face.",
                        "require": "play_named:Quiet Extradition",
                    },
                    {
                        "id": "free",
                        "title": "Own the wing",
                        "text": "Close the match at 12 life.",
                        "require": "free",
                    },
                ],
                "rewards": {"ledger_ids": ["file_bounce"]},
                "reverse": reverse_block(
                    "Soft Exile — Breached",
                    "Templars hold the exits.",
                    "Gate Warden",
                    rev_a,
                    14,
                ),
            },
            {
                "id": "hq_armory",
                "type": "safehouse",
                "title": "Black Budget Armory",
                "blurb": "Pick one tool for the ledger (and future runs).",
                "map": {"x": 0.78, "y": 0.58},
                "requires": ["train_bounce"],
                "unlocks": ["hq_breach"],
                "safehouse": {
                    "text": "Choose one. It is logged in your Investigation Ledger.",
                    "pick_one_of": [
                        {
                            "id": "illuminati_spell_013",
                            "label": "Leak Dump",
                            "blurb": "Draw 2. Opponent discards 2.",
                        },
                        {
                            "id": "illuminati_spell_001",
                            "label": "Media Blackout",
                            "blurb": "Silence all enemy characters this turn.",
                        },
                        {
                            "id": "illuminati_char_005",
                            "label": "Puppet Master",
                            "blurb": "Late steal — take a small enemy and draw.",
                        },
                    ],
                },
                "rewards": {"ledger_ids": ["file_armory"]},
            },
            {
                "id": "hq_breach",
                "type": "story",
                "title": "Breach at the Sanctum",
                "blurb": "Templars hit HQ. Fall back through the halls.",
                "map": {"x": 0.88, "y": 0.32},
                "requires": ["hq_armory"],
                "unlocks": [],
                "triggers_reverse": True,
                "story_panels": [
                    {
                        "text": "Alarms smear gold across the marble. \"Templars in the sanctum — they knew the routes.\""
                    },
                    {
                        "text": "Previous halls light red on the board. You will fight back the way you came. Righteous Fortitude hardens every Templar body."
                    },
                    {
                        "text": "Reach the entrance. The Grandmaster is waiting in the smoke."
                    },
                ],
                "rewards": {
                    "ledger_ids": ["file_breach"],
                    "flags": {"hq_breached": True},
                },
            },
            {
                "id": "grandmaster",
                "type": "boss",
                "title": "Templar Grandmaster",
                "blurb": "Exit boss. Walls and cleanses. AI at 16 life.",
                "map": {"x": 0.12, "y": 0.22},
                "requires": [],
                "unlocks": [],
                "boss_requires_reverse_clear": True,
                "ai": {
                    "difficulty": "hard",
                    "name": "Templar Grandmaster",
                    "faction": "templars",
                },
                "player_goes_first": True,
                "shuffle": False,
                "ai_starting_life": 16,
                "player_deck": player,
                "ai_deck": boss,
                "twist": fortitude,
                "teach": True,
                "steps": [
                    {
                        "id": "boss",
                        "title": "Grandmaster",
                        "text": "Fortitude still applies. Break Taunt walls, respect Wrath-style clears, finish at 16 life.",
                        "require": "free",
                    }
                ],
                "rewards": {
                    "ledger_ids": ["file_grandmaster", "file_chapter_complete"],
                    "flags": {
                        "illuminati_chapter_complete": True,
                        "starter_upgrade": True,
                        "reward_stub_packs": 1,
                    },
                },
                "lesson_win": "HQ holds. The Inner Circle marks your file complete — for now.",
                "lesson_loss": "Walls and AoE punish greed. Chip Taunt, then close.",
            },
        ],
        "ledger": {
            "file_hq_arrival": {
                "title": "File: The Lodge",
                "text": "HQ trains Influence as a discipline, not a mood.",
            },
            "file_silence": {
                "title": "File: Silence",
                "text": "Silence strips keywords and text. Walls fall quiet.",
            },
            "file_discard": {
                "title": "File: Discard",
                "text": "Empty hands cannot answer. Attrition is a victory condition.",
            },
            "file_bounce": {
                "title": "File: Bounce",
                "text": "Returning a body buys a turn. Tempo is also control.",
            },
            "file_armory": {
                "title": "File: Black Budget",
                "text": "You selected a tool. The armory remembers.",
            },
            "file_breach": {
                "title": "File: Breach",
                "text": "Templars walked the sanctum. Fortitude marked every fight out.",
            },
            "file_grandmaster": {
                "title": "File: Grandmaster",
                "text": "Faith breaks on marble if you keep swinging.",
            },
            "file_chapter_complete": {
                "title": "File: Inner Circle — Closed",
                "text": "City and HQ survived. Other wings remain sealed.",
            },
        },
    }

    OUT.write_text(json.dumps(board, indent=2) + "\n", encoding="utf-8")
    chapter = json.loads(CHAPTER.read_text(encoding="utf-8"))
    chapter["boards"] = ["city", "hq"]
    CHAPTER.write_text(json.dumps(chapter, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT)
    print("chapter boards", chapter["boards"])


if __name__ == "__main__":
    main()
