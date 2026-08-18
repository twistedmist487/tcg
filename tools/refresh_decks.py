"""Rewrite curated faction lists and add brew presets."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = ROOT / "data" / "decks.json"


def entries(*pairs: tuple[str, int]) -> list[dict]:
    return [{"id": i, "copies": n} for i, n in pairs]


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    data["illuminati"] = {
        "name": "Illuminati Shadow Council",
        "description": "Control: discard, bounce, silence, and hand advantage. Hires Double Agent and cheap Network mute.",
        "cards": entries(
            ("illuminati_char_006", 2),
            ("illuminati_char_009", 2),
            ("illuminati_char_015", 2),
            ("illuminati_spell_011", 2),
            ("illuminati_spell_008", 2),
            ("illuminati_char_001", 2),
            ("illuminati_spell_012", 2),
            ("illuminati_spell_013", 2),
            ("illuminati_char_016", 2),
            ("illuminati_char_018", 2),
            ("illuminati_spell_001", 2),
            ("illuminati_loc_007", 2),
            ("neutral_char_004", 2),
            ("neutral_spell_014", 2),
            ("illuminati_spell_002", 2),
        ),
    }
    data["templars"] = {
        "name": "Templar Holy Host",
        "description": "Defense: Shielding, Recur walls, heals, and holy removal. Hires Relic Courier.",
        "cards": entries(
            ("templars_char_015", 2),
            ("templars_char_009", 2),
            ("templars_spell_011", 2),
            ("templars_char_016", 2),
            ("templars_spell_003", 2),
            ("templars_char_002", 2),
            ("neutral_char_005", 2),
            ("templars_char_017", 2),
            ("templars_spell_001", 2),
            ("templars_spell_012", 2),
            ("templars_char_018", 2),
            ("templars_loc_007", 2),
            ("templars_loc_008", 2),
            ("templars_char_006", 2),
            ("neutral_spell_017", 2),
        ),
    }
    data["reptilians"] = {
        "name": "Reptilian Invasion Force",
        "description": "Aggro swarm: Rush, Venom, tokens, and face pings. Hires Skin-Walker and cheap Network Rush.",
        "cards": entries(
            ("reptilians_char_015", 2),
            ("reptilians_char_007", 2),
            ("reptilians_char_016", 2),
            ("reptilians_spell_011", 2),
            ("reptilians_char_005", 2),
            ("neutral_char_024", 2),
            ("neutral_char_006", 2),
            ("reptilians_char_017", 2),
            ("reptilians_spell_013", 2),
            ("reptilians_char_018", 2),
            ("reptilians_spell_012", 2),
            ("reptilians_loc_007", 2),
            ("reptilians_loc_008", 2),
            ("reptilians_char_009", 2),
            ("reptilians_char_012", 2),
        ),
    }
    presets = [p for p in data.get("presets", []) if p.get("id") not in ("test_silence_toolbox", "test_recycle_engine")]
    presets.append(
        {
            "id": "test_silence_toolbox",
            "name": "Test: Silence Toolbox",
            "faction": "illuminati",
            "description": "Mute, Blackout, Ombudsman, and Network silence. For locking boards.",
            "cards": entries(
                ("illuminati_spell_001", 2),
                ("illuminati_char_018", 2),
                ("neutral_spell_002", 2),
                ("neutral_spell_014", 2),
                ("illuminati_char_015", 2),
                ("illuminati_spell_012", 2),
                ("illuminati_char_008", 2),
                ("illuminati_spell_010", 2),
                ("neutral_spell_006", 2),
                ("neutral_spell_019", 2),
                ("illuminati_char_006", 2),
                ("illuminati_spell_011", 2),
                ("neutral_char_031", 2),
                ("illuminati_loc_007", 2),
                ("neutral_char_022", 2),
            ),
        }
    )
    presets.append(
        {
            "id": "test_recycle_engine",
            "name": "Test: Recycle Engine",
            "faction": "templars",
            "description": "Burn Bag, memos, Fence, Graymail. Cycle until you find the wall.",
            "cards": entries(
                ("neutral_spell_007", 2),
                ("neutral_spell_012", 2),
                ("neutral_spell_020", 2),
                ("neutral_spell_033", 2),
                ("neutral_char_026", 2),
                ("neutral_char_030", 2),
                ("neutral_char_052", 2),
                ("neutral_char_060", 2),
                ("templars_char_009", 2),
                ("templars_char_015", 2),
                ("templars_spell_003", 2),
                ("templars_char_002", 2),
                ("templars_spell_011", 2),
                ("templars_loc_007", 2),
                ("templars_char_016", 2),
            ),
        }
    )
    data["presets"] = presets
    PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("Updated curated decks and brew presets.")


if __name__ == "__main__":
    main()
