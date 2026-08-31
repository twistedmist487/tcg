# Single-Player Campaign Design — Conspiracy TCG

Canonical design for the **narrative campaign** SP spine.  
Derived from NotebookLM notes (`docs/plans/notebook-sp-raw.md`, structured in
`docs/plans/notebook-sp-brief.md`). Agent execution:
`docs/plans/phase9-sp-agent-team.md` + `python -m agents.orchestrator`.

**Status:** M0–M3 shipped for Illuminati (City teach board + HQ reverse siege + ledger). Vault of Faith playable in the React client (Hallowed Ground, Chaplain, Guardian of the Seal). Next: Reptilian Psionic Hive / economy stubs.  
**Out of scope for v1 ship:** currency economy, pack opening UI.

### M0 decisions (locked)

| Question | Decision |
|----------|----------|
| Priority | **Campaign first** (Phase 9 QoL opportunistic only) |
| Comics | **Text panel stubs** (no art pipeline required) |
| Teaching | **Fold into City Board 1**; First Contact not the SP spine (may remain as optional free-play or deprecate later) |
| Starter deck | **Illuminati-lite hybrid** (`campaign_illuminati_city_starter` preset) |

---

## 1. Player fantasy

You are recruited into the shadow war. Each faction chapter is an **investigation
board**: move node to node, learn by fighting themed AI, survive crises, beat a
boss, unlock ledger files. Your deck starts weak and specializes as you salvage
cards. Vs AI and the deck builder remain available from the main menu as free play.

---

## 2. Mode stack (product)

```
Main menu
├── Campaign (Investigation)     ← primary SP spine (new)
├── First Contact (optional)     ← short rules on-ramp (existing)
├── Keyword Lab                  ← existing
├── Play vs AI / Challenges      ← existing free play
└── Deck Builder                 ← existing
```

---

## 3. Campaign data model (proposed)

```
data/campaign/
  index.json                 # chapters list, unlock graph
  illuminati/
    chapter.json             # meta, difficulties, starter deck
    board_city.json          # Board 1 nodes
    board_hq.json            # Board 2 nodes + reverse graph
  _schema.md                 # field docs
```

### Node object (sketch)

```json
{
  "id": "city_street_01",
  "type": "combat | crisis | story | safehouse | boss",
  "title": "Harbor Drop",
  "blurb": "A Network courier wants out.",
  "map": {"x": 0.2, "y": 0.6},
  "requires": [],
  "unlocks": ["city_street_02"],
  "ai": {"difficulty": "easy", "name": "Street Broker", "faction": "network"},
  "player_deck": "run",
  "opponent_deck": ["neutral_char_001", "..."],
  "twist_ids": [],
  "crisis": null,
  "dialogue": [{"speaker": "Recruiter", "text": "Spend your energy."}],
  "rewards": {"bucket_ids": ["net_early_a"], "ledger_ids": ["file_energy"]},
  "story_panels": [{"text": "...", "art": null}]
}
```

### Crisis

```json
{
  "win": "survive_turns",
  "turns": 5,
  "lose_if_hero_dead": true
}
```

### Twist registry (global during match)

| id | effect (v1) |
|----|-------------|
| `templar_fortitude` | Enemy characters enter play with +1 Health |
| `hallowed_ground` | First character you play each turn gets +2 Health |
| `liquid_assets` | When a player discards, they gain +1 energy next turn (needs discard hook) |
| `static_air` | Every 3rd spell cast is negated (counter) |

v1 ships **templar_fortitude** (Illuminati HQ reverse) and **hallowed_ground** (Vault of Faith). `static_air` is next (Psionic Hive).

### Run state (browser localStorage or server session)

```json
{
  "chapter_id": "illuminati",
  "difficulty": "normal",
  "board_id": "city",
  "cleared": ["city_intro"],
  "active_reverse": false,
  "deck": [{"id": "…", "copies": 1}],
  "ledger": ["file_energy"],
  "flags": {"recruiter_dead": false},
  "seed": 42
}
```

---

## 4. Illuminati chapter — Board 1 City Initiation

| Order | Node | Type | Teaches | Notes |
|------:|------|------|---------|-------|
| 0 | Approached | story | fantasy | Comic panels: watched & selected |
| 1 | Alley Contact | combat | play/attack | Easy Network-ish AI |
| 2 | Archives | combat | trades | Slightly better curve |
| 3 | Safe Drop | safehouse | deck | Optional prune / +1 card bucket |
| 4 | Rooftop | combat | energy curve | |
| 5 | Initiation Duel | boss | full loop | Win → story ambush |
| 6 | Traitor’s Toll | crisis | survive | Survive 5 turns; story: Recruiter dies |

**Starter deck (v1 proposal):** 30 cards, mostly Network + few Illuminati teach pieces already in pool. Exact list owned by Content agent after card map.

**AI:** Easy throughout Board 1 except boss Medium.

---

## 5. Illuminati chapter — Board 2 HQ

| Phase | Nodes | Notes |
|-------|-------|-------|
| Training | 3–4 combat | Introduce Taunt, discard/bounce/silence via enemy lists + dialogue |
| Apex | story | Templars breach |
| Reverse | prior nodes flipped | Same graph, `enemy_faction=templars`, twist `templar_fortitude` |
| Exit boss | Templar Grandmaster | Walls + removal; Medium/Hard by difficulty |

**Rewards (v1):** ledger pack of Illuminati files; `starter_upgrade` flag for free play; `reward_stub.packs = 1` for future economy.

---

## 6. Later chapters

### Templars — Vault of Faith
Shipped in the React client. Twist: **Hallowed Ground** (first character each player plays each turn gains +2 Health). Board: intro → Nave Watch (Squire/Taunt) → Infirmary (heal) → Vestry (relic pick) → Crypt Signal (Charge + Hallowed) → Inner Gate (run kit, Knight Commander) → **Guardian of the Seal** (24 life, Taunt wall). Unlocks after Inner Circle.

### Reptilians — Psionic Hive
- Twist: Static Air  
- Boss: Psionic Slaver fantasy (temp steal highest ATK — needs timed mind-control; else hard stealth deck)
- Unlocks after Vault of Faith

---

## 7. Control content track (parallel)

### Constructed presets to add in `decks.json` (when cards exist)
- illuminati_shadow_mandate  
- illuminati_puppet_gambit  
- templars_iron_cathedral  
- templars_divine_retribution  
- reptilians_neural_static  
- reptilians_ancient_hive  

### Notebook new cards — priority tiers

**Tier A — expressible soon (extend effects lightly):**  
Grand Archivist-like discard+copy, simple Taunt punishers, heal locations, stealth +ATK aura (partial), Emergency Broadcast-like AoE+draw if not already covered by pool.

**Tier B — needs systems:** multi-turn Exhaust, scry opponent deck, top-deck peek both sides, spell-tax auras, token Fragmented Thought mill engine.

**Tier C — campaign-only bosses:** custom hero powers / seal break — after map ships.

**Default path:** Content agent first produces **existing-ID decklists** that *feel* like each archetype; Balance validates WR; only then author Tier A cards.

---

## 8. UI surfaces

1. **Campaign hub** — chapter select, difficulty, continue run  
2. **Board map** — node graph, simple CSS/canvas positions  
3. **Story panels** — full-screen text (+ optional image later)  
4. **Match** — reuse Conspiracy Table; overlay twist banner + crisis turn counter  
5. **Safe House** — minimal: remove 1 card / pick 1 of 3  
6. **Ledger** — Dossier tab “Investigation” unlocked entries  

---

## 9. Engine / API work (minimal v1)

| Change | Why |
|--------|-----|
| `Game` optional `win_condition`: hero_kill \| survive_turns(N) | Escape crisis |
| Match modifiers: `enemy_character_health_bonus` | Twist |
| Campaign run endpoints or pure client orchestration calling existing `/api/game/*` | Speed |
| Serialize twist/crisis into state for UI | Banner + counter |

Prefer **client-orchestrated campaign** (JS holds run state, starts matches via existing API) for v1 to avoid a second session system — unless server AI/deck building forces server authority (then thin `server/campaign.py`).

---

## 10. Acceptance — Illuminati v1

- [ ] New player can start Illuminati Normal without docs  
- [ ] Board 1 completable; Escape crisis works  
- [ ] Board 2 reverse + twist + boss completable  
- [ ] Run state survives refresh  
- [ ] Ledger shows ≥3 new files  
- [ ] No multiplayer code paths  
- [ ] `make test` green; campaign schema validated  

---

## 11. Agent ownership

| Slice | Roles |
|-------|--------|
| Design freeze / journey copy | Orchestrator + Experience |
| Card→archetype map + decks | Content + Balance |
| Campaign JSON | Encounter + Experience |
| Crisis + twist engine | Balance/Engine (frontend coordinates) |
| Map + story UI | Frontend |
| Verify paths | QA |

See board: `docs/plans/sp-agent-board.json`.
