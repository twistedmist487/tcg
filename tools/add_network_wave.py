"""Append the remaining Network cards toward a 120-card pool."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS_PATH = ROOT / "data" / "cards.json"

def char(n, name, cost, atk, hp, ability, lore):
    return {
        "id": f"neutral_char_{n:03d}",
        "name": name,
        "type": "Character",
        "faction": "neutral",
        "cost": cost,
        "energy_type": "Conspiracy",
        "attack": atk,
        "health": hp,
        "ability": ability,
        "lore": lore,
    }


def spell(n, name, cost, effect, lore):
    return {
        "id": f"neutral_spell_{n:03d}",
        "name": name,
        "type": "Spell",
        "faction": "neutral",
        "cost": cost,
        "energy_type": "Conspiracy",
        "effect": effect,
        "lore": lore,
    }


def loc(n, name, cost, effect, lore):
    return {
        "id": f"neutral_loc_{n:03d}",
        "name": name,
        "type": "Location",
        "faction": "neutral",
        "cost": cost,
        "energy_type": "Conspiracy",
        "effect": effect,
        "lore": lore,
    }


CARDS = [
    char(29, "Desk Clerk", 2, 2, 1, "No special ability.", "He stamps whatever you slide under the glass."),
    char(30, "Fence", 3, 1, 2, "Recycle.", "He buys trouble by the pound and sells it by the rumor."),
    char(31, "Lookout", 2, 1, 1, "Stealth.", "Two short whistles means run. One means you are already late."),
    char(32, "Paid Witness", 4, 2, 3, "No special ability.", "His memory costs extra after lunch."),
    char(33, "Shield Bearer", 3, 1, 2, "Shielding.", "The vest is rented. The bruise is yours."),
    char(34, "Revenant Hire", 3, 2, 1, "Recur.", "Kill him twice. The invoice lists both."),
    char(35, "Blood Broker", 4, 2, 2, "Drain.", "He takes a cut. Literally."),
    char(36, "Stinger", 2, 1, 1, "Venom.", "A needle, a handshake, a closed casket."),
    char(37, "Overkill Man", 5, 3, 2, "Excess: Draw a card.", "The second shot is for the filing cabinet."),
    char(38, "Signal Tech", 3, 1, 2, "Amplify.", "He boosts whatever you should not be broadcasting."),
    char(39, "Spare Clip", 1, 1, 1, "No special ability.", "Not a person. Not quite cargo."),
    char(40, "Door Man", 3, 1, 2, "Taunt.", "Nobody gets in. Nobody gets out pretty."),
    char(41, "Alley Runner", 3, 2, 1, "Rush.", "He does not use streets. Streets have names."),
    char(42, "Rage Temp", 5, 2, 3, "Enraged.", "Paid hourly. The hour has two swings."),
    char(43, "Intern Asset", 3, 1, 2, "Assault: Deal 1 damage to a target character.", "The coffee run was cover."),
    char(44, "Egg Case", 4, 1, 3, "Deathrattle: Summon a 2/1 Raptor.", "Do not open it. Do not leave it."),
    char(45, "Late Charge", 5, 2, 3, "Charge.", "Expensive because he does not wait."),
    char(46, "Second Barrel", 4, 2, 2, "Chain: Deal 2 damage to the enemy hero.", "The first shot is conversation."),
    char(47, "Quiet Vest", 4, 1, 3, "Ward.", "The first volley hits the fabric, not the man."),
    char(48, "Walk-On", 3, 2, 1, "Manifest.", "He was not on the call sheet. He is on the floor."),
    char(49, "Wire Rookie", 3, 1, 2, "Retaliate: Deal 1 damage to the enemy hero.", "He flinches. The wire does not."),
    char(50, "Mid Manager", 5, 3, 3, "No special ability.", "He approves nothing and delays everything."),
    char(51, "Harbor Merc", 6, 3, 4, "No special ability.", "Union rate. Ununion methods."),
    char(52, "Soft Barricade", 4, 1, 3, "Taunt. Recycle.", "Cardboard and a stare. Surprisingly effective."),
    char(53, "Leech Fly", 2, 1, 1, "Drain.", "Small mouth. Persistent."),
    char(54, "Cockroach Hire", 2, 1, 1, "Recur.", "You cannot fire what will not stay dead."),
    char(55, "Shadow Rat", 3, 1, 2, "Stealth.", "If you saw it, it wanted you to."),
    char(56, "Hall Sprinter", 4, 2, 2, "Rush.", "He hits the door, not the suit."),
    char(57, "Senior Contractor", 6, 4, 3, "No special ability.", "The rate went up. The morals did not."),
    char(58, "Pocket Plate", 1, 1, 1, "Shielding.", "A bible, a flask, or a plate. Same pocket."),
    char(59, "Two-Bit", 3, 1, 3, "No special ability.", "Cheap help. Cheap results. Still help."),
    char(60, "Bag Man", 4, 2, 3, "Recycle.", "The bag is heavy. The name is empty."),
    char(61, "Last Call", 7, 4, 4, "No special ability.", "He only works after midnight and before regret."),
    spell(18, "Pinprick", 2, "Deal 1 damage to a target character.", "Not enough to kill. Enough to remember."),
    spell(19, "Hold Still", 3, "Give a target character Stasis.", "The ice is in the veins, not the glass."),
    spell(20, "Trash Fax", 1, "Recycle. Deal 1 damage to the enemy hero.", "Shred, send, forget."),
    spell(21, "Tip Line", 2, "Discover a card.", "Three voices. One useful."),
    spell(22, "Patch Job", 2, "Restore 2 Health to your hero.", "Tape and a curse. Good as new-ish."),
    spell(23, "Soft Exile", 4, "Return an enemy character with 2 or less Attack to its owner's hand.", "Walk him out. Do not wave."),
    spell(24, "After Hours", 3, "Deal 1 damage to the enemy hero. Draw a card.", "The building is closed. The work is not."),
    spell(25, "Split Ticket", 3, "Split: Deal 1 damage to a target character. | Draw a card.", "Pick a cover. Burn the other."),
    spell(26, "Quiet Room", 3, "Your hero has Ward until end of turn.", "No windows. No incoming."),
    spell(27, "Flash Note", 2, "Flash. Deal 1 damage to the enemy hero.", "Read it and it is already gone."),
    spell(28, "Loose Change", 1, "Draw a card.", "Enough for a call. Not enough for silence."),
    spell(29, "Two-Tap", 4, "Deal 2 damage to a target character. Draw a card.", "One to startle. One to file."),
    spell(30, "Shoo", 2, "Return an enemy character with 1 or less Attack to its owner's hand.", "Go home. Stay gone."),
    spell(31, "Static Burst", 4, "Deal 1 damage to all enemy characters.", "The lights flicker. So do they."),
    spell(32, "Warm Cloth", 3, "Restore 2 Health to your hero. Draw a card.", "Not medicine. Close enough."),
    spell(33, "Recycled Round", 2, "Recycle. Deal 1 damage to a target character.", "Fired once. Filed. Fired again."),
    spell(34, "Forked Favor", 3, "Split: Restore 2 Health to your hero. | Deal 1 damage to a target character.", "Mercy or a bruise. Not both."),
    spell(35, "Earpiece", 2, "Look at opponent's hand. Draw a card.", "You hear the plan. Then you write a better one."),
    spell(36, "Open Line", 3, "Discover a card.", "The third file is never the one they wanted you to pick."),
    spell(37, "Tap Face", 3, "Deal 1 damage to the enemy hero. Draw a card.", "A reminder that someone is watching."),
    spell(38, "Crowd Shock", 5, "Deal 2 damage to all enemy characters.", "Not a riot. A suggestion."),
    spell(39, "Tin Vest", 3, "Give a friendly character Shielding.", "It will stop the first one. That is the point."),
    spell(40, "Smoke Step", 3, "Give a friendly character Stealth.", "Walk out in the cloud. Do not look back."),
    spell(41, "Loose Egg", 4, "Summon a 2/1 Raptor.", "It was in the briefcase. It is not now."),
    spell(42, "Long Read", 5, "Draw 2 cards.", "Too many pages. One of them matters."),
    loc(6, "Parking Garage", 3, "At the start of your turn, deal 1 damage to the enemy hero.", "Level C. No cameras. One echo."),
    loc(7, "Clinic Cot", 4, "At the start of your turn, restore 1 Health to your hero.", "The nurse does not ask names."),
    loc(8, "Filing Cage", 5, "At the start of your turn, if you have fewer cards than your opponent, draw a card.", "Lost files find the person who needs them least."),
    loc(9, "Night Shift", 6, "At the start of your turn, heal 1 damage from all your characters.", "The building hums. The bruises fade."),
    loc(10, "Empty Lot", 4, "At the start of your turn, restore 1 Health to your hero.", "Weeds, glass, and a deal."),
    loc(11, "Black Site Annex", 7, "At the start of your turn, deal 1 damage to the enemy hero.", "Off the books. Still on the map."),
    loc(12, "Hourly Motel", 5, "At the start of your turn, restore 1 Health to your hero.", "The ice machine works. The locks do not."),
    loc(13, "Pier Shed", 6, "At the start of your turn, deal 1 damage to the enemy hero.", "Salt, rust, and a light that never turns off."),
    loc(14, "Back Clinic", 5, "At the start of your turn, heal 1 damage from all your characters.", "No license. Steady hands."),
    loc(15, "Switchboard", 4, "At the start of your turn, if you have fewer cards than your opponent, draw a card.", "Every call is a rumor with a destination."),
    loc(16, "Surplus Closet", 3, "At the start of your turn, restore 1 Health to your hero.", "Bandages older than the war they were packed for."),
]


def main() -> int:
    cards = json.loads(CARDS_PATH.read_text(encoding="utf-8"))
    existing = {c["id"] for c in cards}
    added = 0
    for card in CARDS:
        if card["id"] in existing:
            continue
        cards.append(card)
        added += 1
    CARDS_PATH.write_text(json.dumps(cards, indent=2) + "\n", encoding="utf-8")
    print(f"Added {added} Network cards. Total now {len(cards)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
