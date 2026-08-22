# Development Roadmap

This document tracks the development plan for Conspiracy TCG.

**Product direction:** Conspiracy TCG is a single-player game. Players learn
through an interactive tutorial, then play against AI opponents with curated
or custom decks. Online multiplayer, matchmaking, lobbies, and human-vs-human
play are out of scope. The existing two-human CLI mode is a leftover test
harness, not a product feature.

## Phase 0: Project Scaffolding [COMPLETE]
Goal: Clean, navigable project structure with tooling wired up.

- [x] Initialize git repo with .gitignore
- [x] Create root README.md
- [x] Create AGENTS.md for AI cocreators
- [x] Reorganize docs/ into design/ and dev/
- [x] Add pyproject.toml with tooling config
- [x] Create Makefile with common commands
- [x] Write Phase 0 validation script (card schema checker)

## Phase 1: Data Model Hardening [COMPLETE]
Goal: Robust, validated card data model.

- [x] Create Pydantic Card models (Character, Spell, Location)
- [x] Create Pydantic Faction model
- [x] Write card loader using Pydantic models
- [x] Add 18 tests for models and loader (29 total with Phase 0)
- [x] Validate all 12 existing cards against new models

## Phase 2: Game Engine -- Core Logic [COMPLETE]
Goal: Python game engine, two-human CLI play.

- [x] CardInstance: mutable runtime state (health, buffs, stealth, etc.)
- [x] Player state: deck, hand, board, life, energy management
- [x] Combat resolution: character vs character, direct attacks, simultaneous damage
- [x] Keyword mechanics: Taunt, Stealth, Silence, Exhausted
- [x] Game engine: turn loop, setup, win conditions, action dispatch
- [x] JSON serialization: save/load full game state
- [x] CLI game: two-human text interface with faction selection
- [x] 65 new tests (94 total) covering all engine modules

## Phase 3: Card Expansion [COMPLETE]
Goal: 8+ cards per faction, new thematic depth.

- [x] 15 new cards (5 per faction) validated via schema checker
- [x] Illuminati: Corporate control, human weapons, government programs themes
- [x] Templars: Esoteric warfare, sacred artifacts, divine intervention themes
- [x] Reptilians: Space/orbital weapons, ancient aliens, tech subversion themes
- [x] Expanded factions.md with 9 new sample cards + 3 theme sections
- [x] Balance-tuned stats to match cost heuristics
- [x] 27 total cards (12 original + 15 new)

## Phase 4: Single-Player vs AI [COMPLETE]
Goal: Play against a heuristic AI opponent.

- [x] Rule-based AIPlayer with faction-specific scoring weights
- [x] Action evaluation: play, attack, end turn with board-state heuristics
- [x] Faction flavor: Illuminati (card draw/control), Templars (defense/healing), Reptilians (aggression)
- [x] execute_turn() for full AI turn loop
- [x] 19 new tests covering AI behavior and full game completion
- [x] CLI mode selector: 2-player or vs AI

## Phase 5: Web Playable Prototype [COMPLETE]
Goal: Browser-based UI with FastAPI backend.

- [x] FastAPI REST API: new game, play, attack, end turn, state, sessions
- [x] In-memory session management with 30-card deck building
- [x] Dark-themed responsive HTML/CSS/JS frontend (no build step)
- [x] Faction selection, card rendering, board display, game log
- [x] Start Turn / Play / Attack / End Turn action flow
- [x] Client-side AI auto-play after human ends turn
- [x] get_state() enriched with faction, cost, ability/effect data
- [x] 14 new server tests (127 total)
- [x] Run with: uvicorn server.app:app --port 8080

## Phase 6: Spell & Location Resolution [COMPLETE]
Goal: Cards that actually do something when played.

- [x] engine/effects.py -- effect resolution system (damage, heal, draw, silence, buff, debuff, bounce, destroy, mind control)
- [x] Spell dispatcher that reads card effect text and routes to handlers
- [x] Trigger system: on-play character abilities, start-of-turn location effects, end-of-turn location effects, ongoing auras
- [x] All 27 existing cards resolve effects in gameplay
- [x] Integrated into Game.play_card(), start_turn(), end_turn()
- [x] Added spell_target_index parameter to play_card for targeted spells
- [x] Fixed AI execute_turn to always end turn even on failed plays
- [x] 39 new tests for effect resolution (166 total)
- [x] Real card effects: Divine Smite deals 4 damage, Media Blackout silences all, Sacred Chapel heals 1 each turn, etc.

---

## Phase 7: Content Expansion [COMPLETE]
Goal: Make decks feel complete and gameplay more varied.

**Completed:**
- [x] 10+ new cards per faction (30+ new total, 90 cards / 30 per faction)
- [x] Fill gameplay gaps: Illuminati (more discard/control/stealth), Templars (more healing/buffs/charge), Reptilians (more stealth/swarm/summon)
- [x] Higher cost cards (7-10 mana) for late-game impact — 3 new legendaries
- [x] New card mechanics: Charge, Deathrattle (on-death summon), Stealth assassins
- [x] Each faction gets a Legendary character (cost 8-10, powerful unique effect)
- [x] Curated 30-card faction decks in data/decks.json
- [x] Deck validation: enforce 30 cards, single faction, max 2 copies
- [x] Mulligan system (redraw starting hand before first turn)

**Balancing Pass:**
- [x] AI vs AI playtests across all six faction matchups (20 games each)
- [x] Pre-pass: Templars ~71% / Illuminati ~61% / Reptilians ~16%
- [x] Nerf: Templar early tanks and late walls, Swiss Vault (3 -> 5), economy engines
- [x] Buff: Reptilian mid/late threats (Shape-Shifter, Brood Mother, Overlord 10 -> 9)
- [x] Replay after tuning: Illuminati ~61% / Reptilians ~49% / Templars ~38%
      (was 71 / 16 / 61). All three factions win games; replay via
      `python tools/playtest_balance.py`

---

## Phase 8: Tutorial & Single-Player Experience [COMPLETE]
Goal: Teach new players the game by playing it, then give them a complete
solo loop: tutorial, AI matches, and a deck builder.

**Interactive Tutorial:**
- [x] Guided First Contact match against The Recruiter (Easy, skip-able, replayable)
- [x] Teaches by doing: energy, exhaustion, combat, Taunt, spells, locations
- [x] Contextual hint panel on the live board
- [x] Recap screen with a rules cheat sheet after the tutorial
- [x] How to Play menu entry to replay the tutorial

**Browser pass (2026-08-14):** Opening flow worked; combat hint, targeting,
locations, turn labels, and a stalling 30–30 match were broken. Those
fixes landed in Phase 9 and were re-checked in Chromium (desktop + 390x844).

**Solo Play:**
- [x] Main menu: Play vs AI with faction, opponent faction, Easy / Medium / Hard
- [x] Easy AI is conservative (mistakes + skipped attacks); Medium is the heuristic
- [x] Showcase encounters: Shadow Council, Holy Host, Invasion Force
- [x] Post-match recap: cards played, damage, lesson if you lost
- [x] Server-side AI turn (`POST /api/game/{id}/ai-turn`)
- [x] Mulligan screen before the first turn (skipped in tutorial)

**Deck Builder (solo only):**
- [x] Web UI for 30-card decks from a faction pool
- [x] Filter by cost, type, keyword; save/load in localStorage
- [x] Play a custom deck against AI

**Backend / data:**
- [x] data/encounters.json (tutorial + 3 showcases)
- [x] engine/decks.py validation and construction
- [x] Local deck persistence (browser localStorage)
- [x] No WebSockets, lobbies, matchmaking, or accounts

---

## Phase 9: Polish & Replayability [IN PROGRESS]
Goal: Make the solo game feel complete after the tutorial. Onboarding,
The Network, and the evergreen keyword wave are in. The 240-card pool and 12-Network hire cap are in. Remaining Phase 9
work is visual polish and QoL.

### Next 3 steps

**Card pool expansion (in progress, after constructed 2-copy / 10 energy):**
- [x] Network hire cap 8 → 12
- [x] 40 cards per faction (was 30)
- [x] Network 50 / 120 (first utility wave)
- [x] Network to 120 (bodies, interaction, card flow, combat keywords, tempo, locations)
- [x] Refresh curated 30s and brew presets (Silence Toolbox, Recycle Engine)

1. **Teach what we just built (tutorial + keyword reference).** DONE.
   First Contact now includes a Deathrattle beat (Hatchling Brood → Raptor).
   Keyword Lab (`keyword_lab`) teaches Recycle, Split, Drain, and Ward one
   at a time. How to Play is a short loop plus a searchable glossary.
   Easy Recruiter no longer skips attacks and pokes face so a stall cannot
   last forever.

2. **Rebalance the 240-card pool.** DONE.
   Medium AI scores Recycle, location replace, Stealth-face, Split,
   Discovery, discard/bounce, and the evergreen verbs. 12-game Medium
   pass: Illuminati ~44% / Templars ~50% / Reptilians ~56%. Modest
   curated tune: Shadow Broker 3/3, Ghost Clerk 2/2, Media Blackout 3;
   Crypt Warden 3/5, Guardian 1/3, Penance heal 2, Relic Courier heal 2.
   Flash / Opening / Venom / Amplify did not dominate. Recycle Engine
   and Silence Toolbox brew lists still lose to real curated decks.

3. **Hard AI + challenge encounters.** DONE.
   Hard uses 2-ply look-ahead (greedy rest of turn + opponent Medium reply).
   Three challenge encounters: The Black Room (Network control), Street War
   (Rush/Charge), The Unquiet (Recur/Deathrattle swarm). Play vs AI offers Hard.

**Play table UI (browser, 2026-08-17):**
- [x] Conspiracy Table: history (5) + Dossier + locations | oval field | energy / End Turn / deck
- [x] Generated chrome in `static/ui/` (rails, table, crystals, hourglass, heroes)
- [x] Dossier: hover/click shows art, effect, lore; board/location state includes lore
- [x] Hero portraits replace the wide name/life bars
- [x] Unaffordable hand cards stay opaque; opponent backs are larger
- See [Wiki: Play table UI](../wiki/entities/conspiracy-tcg-ui.md)

---

**Tutorial fixes (browser pass 2026-08-14, implemented):**
- [x] Combat hint now says click the highlighted enemy (or Attack Face)
- [x] Attack Face only appears when face is legal; hidden while a targetable
      enemy is on the board
- [x] Face attacks follow Taunt/Stealth (`can_attack_player_directly` matches
      `Game.attack` — Stealth-only boards no longer block face)
- [x] Spell damage removes dead characters (`Game.play_card` cleanup)
- [x] Location slot per player; Sacred Chapel stays visible after play
- [x] Hint sequencer no longer jumps to "Your move" after the first attack;
      Spells / Locations / a hold hint come first
- [x] Tutorial turn label is "Your turn N" (player actions, not AI turns)
- [x] Recruiter starts at 12 life; opening curve is Hatchling then Taunt;
      Stealth walls moved late
- [x] Spell targeting is click-the-enemy (no `window.prompt`)
- [x] How to Play covers auto draw/energy, exhaustion, locations, mulligan
- [x] Action bar is sticky so Play / Attack / End Turn stay reachable
- [x] Menu confirms before leaving a live match
- [x] Skip tutorial jumps to the rules recap overlay
- [x] Recap is a full-screen overlay with Play vs AI

**The Network (shared cards, implemented):**
- [x] Neutral faction + Conspiracy energy; not a starting identity
- [x] 120 Network cards (62 characters including 1 token, 42 spells, 16 locations)
- [x] Decks: one starting faction + up to 12 Network cards
- [x] Faction-conditional text: "If you are Illuminati/Templars/Reptilians"
- [x] Deck builder shows Faction + Network with a silver border and 12-card cap
- [x] Curated lists hire their matching specialist plus new identity cards
      (Double Agent, Relic Courier, Skin-Walker Hireling)

**Keyword systems (implemented):**
- [x] Shielding — next damage is ignored, then the shield pops (character or hero)
- [x] Assault — on-play from hand; damage/heal/buff/debuff a target
- [x] Deathrattle — on death (summon, face damage, draw); Hatchling Brood hatches a Raptor
- [x] Charge (anyone) and Rush (characters only this turn)
- [x] Enraged — two attacks per turn, persistent
- [x] Discovery — pick 1 of 3 faction+Network cards (`POST /api/game/{id}/discover`)
- [x] Drain, Venom, Recur, Stasis, Amplify, Recycle, Chain, Split, Echo, Excess, Retaliate, Flash, Manifest, Opening, Ward
- [x] Recycle / Split endpoints (`POST /api/game/{id}/recycle`, `/split`)

**Tutorial follow-up:**
- [x] Charge is implemented; Zealot / Raptor Swarm can attack the turn they
      are played. Tutorial has a Charge step.
- [x] Recruiter Taunt wall is Network Contract Guard (not Templar Guardian)
- [x] Deathrattle is implemented (Hatchling Brood summons a Raptor)
- [x] First Contact teaches Hatchling Brood's on-death summon
- [x] Easy Recruiter pokes life (skip_attack_chance 0, face bonus)
- [x] Keyword lab encounter + searchable keyword glossary

**AI Improvements:**
- [x] Medium scores Recycle, location replace, Stealth-face, Split, Discovery, evergreen verbs
- [x] Hard AI with 2-ply look-ahead (rest of turn + opponent Medium reply)
- [x] Challenge encounters: Black Room, Street War, The Unquiet

**Visual Polish:**
- [x] Card art placeholders with faction-themed icons (faction plates)
- [x] Hearthstone-style battlefield: opponent hero, two minion rows, your hero
- [x] Drag to play from hand; drag to attack onto enemies or face
- [x] Damage animations, play fly-ins, HP/ATK pop, death fade, center-packed board
- Sound effects (optional, browser-based)
- [x] Responsive mobile-friendly layout (action bar must stay reachable)
- [x] Visible location slot; targetable-enemy outline used in attack and
      spell-target mode
- [x] Faction powers (cost 2, once per turn) in commander frames
- [x] 75s player turn clock with occult hourglass and 10s AFK penalty

**Quality of Life:**
- Keyboard shortcuts
- Undo last action
- Game speed settings (including AI think time)
- Card collection browser with search/filter
- [x] Static rules / keyword reference that complements the live tutorial
- Export/import game state for debugging
- [x] Confirm before abandoning a live match

---

*Total tests: 324*
*Total cards: 240 (40 per faction + 120 Network, including 1 token)*
*Constructed: 30-card decks, max 2 copies, energy cap 10, max 12 Network*
*Curated 30-card faction decks + 10 test/brew presets in data/decks.json*
*Tutorial + Keyword Lab + 3 showcase encounters in data/encounters.json*
