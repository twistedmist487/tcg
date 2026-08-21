---
title: Conspiracy TCG
created: 2026-08-15
updated: 2026-08-20
type: entity
tags: [project, gaming, conspiracy, secret-society, status]
sources: []
confidence: high
contested: false
---

# Conspiracy TCG

Single-player card game. Three conspiracies fight for the same world. Learn in a guided match, then play against AI. No multiplayer, accounts, or matchmaking.

**Path:** `C:\Users\chris\OneDrive\Documents\tcg`  
**Theme fuel:** Robert Storey's *Ancient Origins* series, plus the same conspiracy well as [[secret-stories-channel]]

## Status (2026-08-17)

Playable through Phase 8. Phase 9 Hard AI is in: 2-ply look-ahead plus three challenge encounters (Black Room, Street War, The Unquiet). Visual polish and QoL remain.

| | |
|---|---|
| Phases 0–8 | Complete (engine, web UI, tutorial, deck builder) |
| Phase 9 | In progress — Hard AI + challenges in; polish next |
| Tests | 306 passing |
| Cards | 240 — 40 per faction + 120 Network (1 token) |
| Loop | Tutorial → Keyword Lab → Play vs AI / faction encounters → deck builder |


## How to run

From the project folder:

```powershell
python -m uvicorn server.app:app --reload --port 8080
```

Open [http://localhost:8080](http://localhost:8080). Hard-refresh (`Ctrl+F5`) after frontend edits.

`--reload` restarts on Python / `data/*.json` changes. After frontend-only edits a hard-refresh is enough. To restart by hand: `Ctrl+C` in that terminal, then the same command.

CLI vs AI: `python -m cli/game.py` → Single Player.

## Factions

| Identity | Energy | Wants |
|---|---|---|
| **Illuminati** | Influence | Control, discard, stealth |
| **Templars** | Faith | Taunt, heal, outlast |
| **Reptilians** | Psionics | Aggro, stealth, swarm |
| **The Network** | Conspiracy | Shared hire-pool, not a starting faction |

Network cards can go in any 30-card deck (max 12). They are printed weaker than faction cards and pay that back in utility. A few get better if they match your identity (Double Agent, Relic Courier, Skin-Walker Hireling, Consecrated Tip, The Exchange).

## How a match works

- 30-card deck, max 2 copies, one starting faction + optional Network
- 30 life; energy starts at 1 and grows by 1 each turn (max 10)
- Board max 7 characters; one location at a time
- Characters enter **exhausted** unless they have **Charge** (can hit anyone) or **Rush** (characters only that turn)
- **Taunt** must be attacked first. **Stealth** cannot be targeted until that character attacks (you may hit face instead)
- Win at 0 life or deck-out

**First Contact** tutorial: play as Recruit (Templars) vs The Recruiter (Easy Reptilians, 12 life). Teaches energy, exhaustion, combat, Taunt, Deathrattle (Hatchling Brood → Raptor), spells, locations, Charge. Recruiter's Taunt wall is Network Contract Guard. Recruiter pokes face so a stall cannot last forever.

**Keyword Lab:** skippable drill vs The Instructor. Recycle (Burn Bag) → Split (Forked Brief) → Drain (Leech Contact) → Ward (Quiet Vest).

## Keywords (Conspiracy names)

Core: Taunt, Stealth, Silence, Exhausted, Charge, Rush.

Systems wave: **Shielding** (next hit pops), **Assault** (when played from hand), **Deathrattle** (on death; Hatchling Brood → Raptor), **Enraged** (two attacks / turn), **Discovery** (pick 1 of 3 faction+Network).

Evergreen wave: **Drain**, **Venom**, **Recur**, **Stasis**, **Amplify**, **Recycle**, **Chain**, **Split**, **Echo**, **Excess**, **Retaliate**, **Flash**, **Manifest**, **Opening**, **Ward** (all damage ignored until end of turn; does not pop).

Demo Network cards for those verbs: Leech Contact, Toxin Needle, Sleeper Cell, Signal Booster, Second Strike, Walk-In, Overpen, Tripwire, Black Ice, Burn Bag, Forked Brief, Carbon Copy, Dead Drop Memo, Safe House, Contingency.

## Art

Faction card frames (fronts + backs) live under `static/cards/` and `assets/card-templates/`. Table chrome, energy crystals, End Turn, and hero portraits live under `static/ui/` (authoring copy: `assets/ui-table/`). Per-card illustration is still open.

Match HUD details: [[conspiracy-tcg-ui]].

## Repo map (what matters)

| Path | What it is |
|---|---|
| `engine/` | Pure Python rules. No UI. |
| [[conspiracy-tcg-cards]] | Full card tables (name, cost, stats, effect) |
| `data/cards.json` | All 240 cards |
| `data/decks.json` | Curated 30s + 10 test/brew presets |
| `data/encounters.json` | Tutorial + Keyword Lab + 3 showcases + 3 Hard challenges |
| `server/` | FastAPI + in-memory sessions |
| `static/` | SPA + `cards/` plates + `ui/` chrome — no build step |
| `docs/wiki/` | Repo copy of this TCG wiki slice |
| `docs/design/` | Concept, factions, rules |
| `docs/dev/roadmap.md` | Phase checklist + next 3 steps |
| `AGENTS.md` | Guide for AI cocreators |

## Decks you can pick

Curated: Shadow Council (Illuminati control), Holy Host (Templar walls), Invasion Force (Reptilian swarm).

Test/brew: Templar Charge, Templar Walls, Illuminati Denial, Reptilian Swarm, Network Lab, Illuminati Locks, Templar Oath, Reptilian Brood, Silence Toolbox, Recycle Engine.

## Next 3 steps (from the roadmap)

1. **Teach what we just built** — DONE (Deathrattle in First Contact, Keyword Lab, glossary, Recruiter pokes face).
2. **Rebalance the 240-card pool** — Medium AI now scores the new verbs. Run `python tools/playtest_balance.py` and tune anything that dominates.
3. **Hard AI + challenge encounters** — DONE (2-ply Hard; Black Room / Street War / Unquiet).

Out of product scope: multiplayer, matchmaking, Secrets, Quests, hero powers.

## Related

- [[conspiracy-tcg-ui]] — play table, Dossier, hero frames, asset kit
- [[conspiracy-tcg-cards]] — every card in tables
- [[chris]] — owner / project map
- [[secret-stories-channel]] — same conspiracy well, different medium
- [[content-creation-map]] — where this sits vs YouTube / writing
- [[hermes-desktop]] — AI workspace used on this machine
