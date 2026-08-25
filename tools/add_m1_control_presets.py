"""M1: append control archetype + campaign starter presets to decks.json."""

from __future__ import annotations

import json
from pathlib import Path

from engine.decks import load_card_lookup, validate_deck

ROOT = Path(__file__).resolve().parent.parent
DECKS_PATH = ROOT / "data" / "decks.json"


def ents(*pairs: tuple[str, int]) -> list[dict]:
    return [{"id": i, "copies": c} for i, c in pairs]


DECKS: dict[str, dict] = {
    "illuminati_shadow_mandate": {
        "id": "illuminati_shadow_mandate",
        "name": "Shadow Mandate",
        "faction": "illuminati",
        "archetype": "control_attrition",
        "description": (
            "Attrition control: hand attack, discards, card advantage, fatigue. "
            "Notebook Shadow Mandate."
        ),
        "cards": ents(
            ("illuminati_char_006", 2),
            ("illuminati_char_009", 2),
            ("illuminati_char_015", 2),
            ("illuminati_char_001", 2),
            ("illuminati_char_014", 2),
            ("illuminati_spell_011", 2),
            ("illuminati_spell_008", 2),
            ("illuminati_spell_002", 2),
            ("illuminati_spell_013", 2),
            ("illuminati_spell_014", 2),
            ("illuminati_spell_012", 2),
            ("illuminati_loc_007", 2),
            ("neutral_char_004", 2),
            ("neutral_spell_014", 2),
            ("neutral_spell_035", 2),
        ),
    },
    "illuminati_puppet_gambit": {
        "id": "illuminati_puppet_gambit",
        "name": "Puppet Master's Gambit",
        "faction": "illuminati",
        "archetype": "control_theft",
        "description": (
            "Survive with silence/bounce, finish by stealing boards. "
            "Notebook Puppet Master / Memory Thief steal lane."
        ),
        "cards": ents(
            ("illuminati_char_008", 2),
            ("illuminati_char_016", 2),
            ("illuminati_char_017", 2),
            ("illuminati_char_018", 2),
            ("illuminati_char_005", 2),
            ("illuminati_char_003", 2),
            ("illuminati_spell_001", 2),
            ("illuminati_spell_010", 2),
            ("illuminati_spell_003", 2),
            ("illuminati_spell_012", 2),
            ("illuminati_spell_009", 2),
            ("illuminati_loc_003", 2),
            ("neutral_char_004", 2),
            ("neutral_spell_015", 2),
            ("neutral_spell_002", 2),
        ),
    },
    "templars_iron_cathedral": {
        "id": "templars_iron_cathedral",
        "name": "Iron Cathedral",
        "faction": "templars",
        "archetype": "control_walls",
        "description": (
            "Taunt fortress and sustain. Notebook Iron Cathedral / Shield of Order walls."
        ),
        "cards": ents(
            ("templars_char_009", 2),
            ("templars_char_015", 2),
            ("templars_char_002", 2),
            ("templars_char_006", 2),
            ("templars_char_004", 2),
            ("templars_char_007", 2),
            ("templars_char_014", 2),
            ("templars_char_018", 2),
            ("templars_char_010", 1),
            ("templars_char_001", 1),
            ("templars_spell_003", 2),
            ("templars_spell_005", 2),
            ("templars_spell_011", 2),
            ("templars_spell_009", 2),
            ("templars_loc_001", 2),
            ("neutral_char_005", 2),
        ),
    },
    "templars_divine_retribution": {
        "id": "templars_divine_retribution",
        "name": "Divine Retribution",
        "faction": "templars",
        "archetype": "control_reactive_aoe",
        "description": (
            "Stall then clear. Notebook Divine Retribution reactive/AoE control."
        ),
        "cards": ents(
            ("templars_char_009", 2),
            ("templars_char_002", 2),
            ("templars_char_006", 2),
            ("templars_char_011", 2),
            ("templars_char_001", 2),
            ("templars_char_008", 1),
            ("templars_spell_004", 2),
            ("templars_spell_001", 2),
            ("templars_spell_012", 2),
            ("templars_spell_002", 2),
            ("templars_spell_006", 2),
            ("templars_spell_010", 2),
            ("templars_loc_001", 2),
            ("templars_loc_008", 1),
            ("neutral_spell_038", 2),
            ("neutral_spell_031", 2),
        ),
    },
    "reptilians_neural_static": {
        "id": "reptilians_neural_static",
        "name": "Neural Static",
        "faction": "reptilians",
        "archetype": "control_disruption",
        "description": (
            "Tempo deny: debuff, bounce, stasis, soft steal. Notebook Neural Static / Stasis."
        ),
        "cards": ents(
            ("reptilians_char_009", 2),
            ("reptilians_char_001", 2),
            ("reptilians_char_008", 2),
            ("reptilians_char_004", 2),
            ("reptilians_char_002", 2),
            ("reptilians_char_011", 2),
            ("reptilians_spell_004", 2),
            ("reptilians_spell_001", 2),
            ("reptilians_spell_008", 2),
            ("reptilians_spell_006", 2),
            ("reptilians_spell_002", 2),
            ("reptilians_spell_012", 2),
            ("reptilians_loc_003", 2),
            ("neutral_spell_006", 2),
            ("neutral_spell_019", 2),
        ),
    },
    "reptilians_ancient_hive": {
        "id": "reptilians_ancient_hive",
        "name": "Ancient Hive",
        "faction": "reptilians",
        "archetype": "control_stealth_finisher",
        "description": (
            "Early disrupt bodies, stealthed finishers. Notebook Ancient Hive."
        ),
        "cards": ents(
            ("reptilians_char_007", 2),
            ("reptilians_char_009", 2),
            ("reptilians_char_001", 2),
            ("reptilians_char_006", 2),
            ("reptilians_char_011", 2),
            ("reptilians_char_018", 2),
            ("reptilians_char_013", 2),
            ("reptilians_char_014", 1),
            ("reptilians_char_010", 1),
            ("reptilians_spell_011", 2),
            ("reptilians_spell_012", 2),
            ("reptilians_spell_005", 2),
            ("reptilians_spell_001", 2),
            ("reptilians_loc_001", 2),
            ("reptilians_loc_004", 2),
            ("neutral_spell_040", 2),
        ),
    },
    "campaign_illuminati_city_starter": {
        "id": "campaign_illuminati_city_starter",
        "name": "City Initiation Starter",
        "faction": "illuminati",
        "archetype": "campaign_starter",
        "description": (
            "Illuminati-lite hybrid for Board 1: core loop, Taunt, light hand "
            "interaction. Network teaches generic tools."
        ),
        "campaign": "illuminati_city",
        "cards": ents(
            ("illuminati_char_009", 2),
            ("illuminati_char_006", 1),
            ("illuminati_char_002", 2),
            ("illuminati_char_004", 2),
            ("illuminati_char_001", 1),
            ("illuminati_char_015", 1),
            ("illuminati_spell_011", 2),
            ("illuminati_spell_008", 2),
            ("illuminati_spell_004", 2),
            ("illuminati_spell_009", 2),
            ("illuminati_loc_006", 1),
            ("neutral_char_007", 2),
            ("neutral_char_022", 2),
            ("neutral_char_001", 2),
            ("neutral_char_028", 2),
            ("neutral_spell_003", 2),
            ("neutral_spell_022", 2),
        ),
    },
}


def main() -> None:
    lookup = load_card_lookup()
    for key, deck in DECKS.items():
        result = validate_deck(deck["cards"], lookup, faction=deck["faction"])
        total = sum(c["copies"] for c in deck["cards"])
        print(f"{key}: size={total} valid={result['valid']} {result['faction_counts']}")
        if not result["valid"]:
            raise SystemExit(f"{key} invalid: {result['errors']}")

    data = json.loads(DECKS_PATH.read_text(encoding="utf-8"))
    presets = data.get("presets") or []
    m1_ids = set(DECKS)
    presets = [p for p in presets if p.get("id") not in m1_ids]
    for key in DECKS:
        presets.append(DECKS[key])
    data["presets"] = presets
    DECKS_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(DECKS)} presets; total presets now {len(presets)}")


if __name__ == "__main__":
    main()
