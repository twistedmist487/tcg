# Control archetype map (M1)

Maps NotebookLM control fantasies onto the **existing 240-card pool**.
Playable presets live in `data/decks.json` → `presets[]`.

**M0 decisions locked:** campaign-first · text story panels · teach in City Board 1
(not separate First Contact spine) · Illuminati-lite hybrid starter.

---

## Preset index

| Preset id | Name | Faction | Notebook link |
|-----------|------|---------|---------------|
| `illuminati_shadow_mandate` | Shadow Mandate | Illuminati | Attrition / fatigue / discard |
| `illuminati_puppet_gambit` | Puppet Master's Gambit | Illuminati | Steal / late value / Memory Thief steal lane |
| `templars_iron_cathedral` | Iron Cathedral | Templars | Taunt walls / Shield of Order |
| `templars_divine_retribution` | Divine Retribution | Templars | Stall → AoE |
| `reptilians_neural_static` | Neural Static | Reptilians | Disruption / stasis / bounce |
| `reptilians_ancient_hive` | Ancient Hive | Reptilians | Stealth finishers |
| `campaign_illuminati_city_starter` | City Initiation Starter | Illuminati | Board 1 hybrid teach deck |

All lists: 30 cards, ≤2 copies, ≤12 Network. Validated via `engine.decks.validate_deck`.

---

## Illuminati — Shadow Mandate

**Fantasy:** Resource depletion, hand attack, outlast to fatigue.

| Role | Cards (ids) |
|------|-------------|
| Early bodies | Whistleblower `illuminati_char_006`, Lobbyist `…_009` |
| Hand attack | Ghost Clerk `…_015`, Shadow Broker `…_001`, Inside Man `…_014` |
| Info / tax | Dead Letter `spell_011`, Wiretap `spell_008` |
| Discard engines | Black Budget `spell_002`, Leak Dump `spell_013`, Redacted Minutes `spell_014` |
| Bounce | Quiet Extradition `spell_012` |
| Draw loc | Press Pit `loc_007` |
| Network | Double Agent `neutral_char_004`, Mute Button `neutral_spell_014`, Earpiece `neutral_spell_035` |

**Stands in for notebook:** Grand Archivist / Memory Vault mill — partial via discard package; no “copy discarded card into your deck” yet.

---

## Illuminati — Puppet Master's Gambit

**Fantasy:** Neutralize early, steal mid/late.

| Role | Cards |
|------|-------|
| Tax / soft lock | Surveillance Expert, Corporate Gauntlet, Compliance Officer |
| Silence package | Media Blackout, Oath of Silence, Ombudsman |
| Theft finishers | Sleeper Banker, Puppet Master, Manchurian Protocol |
| Survival | Bailout, Quiet Extradition, Swiss Vault |
| Network | Double Agent, Side Door, Plausible Deniability |

*(Disinformation cut for list size; soft lock still via Gauntlet / Surveillance.)*


**Stands in for:** Cognitive Breach (scry opponent deck) — **gap**; use hand-look tools instead.

---

## Templars — Iron Cathedral

**Fantasy:** Taunt castle + heals.

| Role | Cards |
|------|-------|
| Walls | Squire, Guardian, Relic Keeper, Warden, Temple Sentinel, Crypt Warden |
| Capstone | Grand Master Aldric, Knight Commander |
| Sustain | Novice, Battle Chaplain, Absolution, Shield Wall, Anoint, Holy Ground, Sacred Chapel |
| Network | Relic Courier |

**Stands in for:** Guardian of the Seal (silence + −ATK on attackers) — closest is Relic Keeper thorns + Taunt walls; **no attack-triggered silence**.

---

## Templars — Divine Retribution

**Fantasy:** Invite overextend → wipe.

| Role | Cards |
|------|-------|
| Early stall | Squire, Guardian, Chaplain, Absolution |
| Single target | Divine Smite, Penance, Holy Inquisition, Judgment |
| AoE | Consecration, Wrath of God + Network Crowd Shock / Static Burst |
| Glue | Healing Seraph, Knight Commander, Sacred Chapel, Reliquary |

*(Absolution / Relic Courier omitted for curve space; heals via Seraph + Chapel.)*


**Stands in for:** Righteous Decree (+2/−2 swing) — **gap**; use Shield Wall + Consecration / Wrath.

---

## Reptilians — Neural Static

**Fantasy:** Freeze-like deny without true multi-turn Exhaust.

| Role | Cards |
|------|-------|
| Bodies | Chameleon, Shape-Shifter, Psionic Leech, Abduction Specialist, Dominator, Skin Walker |
| Debuff | Neural Scramble, Mind Shatter |
| Bounce | Abduction Beam |
| Info | Mind Probe |
| Soft AoE | Ancient Star Map, Ambush |
| Network stasis | Black Ice, Hold Still |
| Loc | Genesis Chamber |

**Stands in for:** Neural Shutdown (exhaust all, no refresh) and Psionic Slaver multi-turn exhaust — **Tier B engine gaps**. Stasis + bounce + temp steal approximate.

---

## Reptilians — Ancient Hive

**Fantasy:** Hide finishers, burst late.

| Role | Cards |
|------|-------|
| Curve | Hatchling Brood, Chameleon, Shape-Shifter, Mimic |
| Finishers | Skin Walker, Apex Stalker, Psionic Wraith, Alpha Predator, Overlord |
| Support | Shed Skin, Ambush, Genetic Splicer, Neural Scramble |
| Loc | Hidden Hive, Psi Relay Tower |
| Network | Smoke Step |

*(Lookout cut; Stealth package still Shed Skin + Smoke Step + Psi Relay.)*


**Stands in for:** Cloaking Hive (+2 ATK while Stealthed; first play gains Stealth) — partial via Psi Relay + Shed Skin / Smoke Step; **no auto-Stealth on first play/turn**.

---

## Campaign — City Initiation Starter (Illuminati-lite hybrid)

**Purpose:** Board 1 teach deck (replaces bloated separate tutorial spine).

| Teach beat | Cards |
|------------|-------|
| Play / curve | Corporate Shill, PR Operative, Freelance Operative |
| Taunt | Lobbyist, Contract Guard, Night Watchman |
| Hand touch (light) | Dead Letter, Wiretap, Shadow Broker / Ghost Clerk (1 each) |
| Combat tool | Disinformation, Burn Notice |
| Survive | Bailout, Patch Job, Safehouse Cook |
| Identity drip | Federal Reserve Vault (1) |

18 Illuminati + 12 Network. Soft enough for Easy city nodes; seeds Influence fantasy without full Mandate power. (Black Budget deferred to later city rewards.)


---

## How to playtest

```bash
# Web: Play vs AI → pick preset if exposed
# Or:
python -c "from engine.decks import build_named_deck; print(len(build_named_deck('illuminati_shadow_mandate')))"
python tools/playtest_live.py  # if preset ids supported
```

Regenerate presets after edits:

```bash
python tools/add_m1_control_presets.py
```
