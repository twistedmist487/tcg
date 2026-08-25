# SP Agent Team — Campaign-first plan

> **Goal:** Orchestrator-led specialists deliver the NotebookLM single-player
> vision: narrative investigation boards, organic teaching, control content,
> and an Illuminati vertical slice — without multiplayer or a full economy.

**Product boundary:** single-player only. Currency/packs later (stubs OK).  
**Canonical design:** `docs/design/sp_campaign.md`  
**Notebook raw / structured:** `docs/plans/notebook-sp-raw.md`, `notebook-sp-brief.md`  
**Board:** `docs/plans/sp-agent-board.json`  
**CLI:** `python -m agents.orchestrator`

---

## North star

> Tutorial-lite onboarding + **Campaign Investigation Board** where zones teach
> mechanics, bosses close chapters, ledger captures lore, and free play (vs AI /
> builder) stays available forever.

Inspired by Hearthstone adventures / Dungeon Run / Dalaran Heist (notebook sources).

---

## Team

```
                 SP Orchestrator (Hermes parent)
        ┌────────────┼────────────┬─────────────┐
        ▼            ▼            ▼             ▼
   Experience   Encounter    Content+Balance   Frontend+QA
   (journey)    (nodes/JSON) (cards/decks/AI)  (map/UI/tests)
```

| Role | Campaign focus |
|------|----------------|
| **Orchestrator** | Slice order, gates, no scope creep (economy, 3 full wings) |
| **Experience** | Chapter fantasy, panel text, recruiter lines, menu IA |
| **Encounter** | `data/campaign/**` nodes, enemy decks from existing IDs, crises |
| **Content** | Archetype → card ID map; Tier A cards only when needed |
| **Balance** | Crisis/twist engine hooks; AI tier per node; playtest bosses |
| **Frontend** | Campaign hub, map, panels, twist/crisis chrome on table |
| **QA** | Path scripts; refresh persistence; tutorial still works |

Role files: `agents/roles/*.md` (update mission lines when stale).

---

## Workstreams (priority)

### P0 — Design freeze
- [x] Ingest notebook → structured brief + `sp_campaign.md`
- [x] Human OK: campaign-first, text panels, teach in City Board 1, Illuminati-lite starter

### P1 — Content foundation (M1) — DONE
- [x] Map 6 control archetypes → existing cards (`docs/design/control_archetype_map.md`)
- [x] Constructed deck presets in `decks.json` presets[]
- [x] Tier A gap list (`docs/design/tier_a_card_gaps.md`)
- [x] Board 1 starter deck preset `campaign_illuminati_city_starter`

### P2 — Campaign data + engine hooks
- [x] Schema + Illuminati Board 1 JSON (`data/campaign/`)
- [x] `survive_turns` win condition
- [x] One twist hook: enemy +1 Health (for Board 2)
- [ ] Board 2 reverse JSON (M3)

### P3 — UI vertical slice
- [x] Campaign menu entry + Board 1 map
- [x] Story panels (text)
- [x] Start node → table match → return to map with rewards
- [x] Crisis banner + localStorage run

### P4 — Board 1 complete (Escape crisis) — ready for human playtest
### P5 — Board 2 reverse + boss + ledger
### P6 — Difficulties + polish; QoL track opportunistic
### Later — Templar/Reptilian chapters; economy; Tier B cards

---

## Parallel QoL track (optional)

Phase 9 leftovers (shortcuts, speed, collection…) stay valuable but **must not
block** Campaign P3. If two agents run: Frontend A = campaign map, Frontend B =
shortcuts only if they never touch the same `app.js` regions without a merge
owner — prefer sequential edits on `static/app.js`.

---

## How to run

```bash
cd C:/Users/chris/tcg-master
python -m agents.orchestrator status
python -m agents.orchestrator plan
python -m agents.orchestrator brief encounter
python -m agents.orchestrator run --role content --task "Map Memory Thief to existing card IDs" --mark archetype-map
```

Hermes Orchestrator:

1. Read `sp_campaign.md` + board  
2. `delegate_task` one slice with role brief pasted  
3. Merge, `make test`, update board statuses  
4. Human plays the new path once per milestone  

---

## Acceptance gates (every slice)

1. Single-player only  
2. Engine stays UI-free  
3. Prefer existing cards before new JSON power creep  
4. Tests green; campaign JSON validates if present  
5. Playable path or documented design-only deliverable  
6. Board + design docs updated  

---

## Anti-patterns

- Implementing booster shop before Board 1 plays  
- Authoring all notebook cards before map exists  
- Three agents editing `static/app.js`  
- Zone twists that soft-lock new players  
- Dropping free-play vs AI while campaign is WIP  
