# NotebookLM → SP brief (structured)

**Source:** `docs/plans/notebook-sp-raw.md` (full NotebookLM dump, Aug 21–23 2026)  
**Product:** Conspiracy TCG — single-player only  
**Meta note:** Currency / packs / boosters are **explicitly later**. Design hooks now; economy later.

---

## North star (from notebook)

Ship a **narrative, node-based conspiracy campaign** inspired by Hearthstone adventures / Dungeon Run / Dalaran Heist:

- Zones on an investigation map, not one bloated tutorial
- Mechanics taught **organically** by opponents and nodes
- Faction-colored chapters with **zone twists** and **bosses**
- Deck evolves during a run (salvage / buckets); ledger lore unlocks in Dossier
- Difficulties: Normal → Heroic → Anomaly (replay layer)
- In-match AI already scales Easy / Medium / Hard — map AI tier to zone depth

Existing First Contact tutorial remains a **short optional on-ramp**; campaign is the real SP spine.

---

## Pillars

| Pillar | Notebook intent | Repo touchpoints |
|--------|-----------------|------------------|
| **Control content** | Faction control decks + new archetype cards + Network control tools | `data/cards.json`, `data/decks.json`, effects |
| **Campaign map** | Boards/zones, nodes, reverse-progression, cutscenes | new `data/campaign/`, server, static map UI |
| **Organic teaching** | Aggro → control walls → stealth/disruption by zone | encounter decks + recruiter dialogue |
| **Twists** | Zone-wide rules (Liquid Assets, Hallowed Ground, Static Air…) | engine modifiers + session flags |
| **Ledger** | Unlock lore/mechanics in Dossier after first sighting | localStorage meta + Dossier UI |
| **Run rewards** | Card buckets, starter upgrades; packs/currency later | run state JSON; economy stub only |
| **Difficulties** | Normal / Heroic / Anomaly | campaign config + AI tier + HP |

---

## Control archetypes (design targets)

### Illuminati
1. **Shadow Mandate** — attrition / fatigue, discard, deck-out
2. **Puppet Master’s Gambit** — survive → steal / late value
3. **Memory Thief** (card set) — discard + copy into deck/hand

### Templars
1. **Iron Cathedral** — Taunt walls + sustain
2. **Divine Retribution** — stall → AoE punish
3. **Shield of Order** (card set) — Taunt punishers + field swing + heal location

### Reptilians
1. **Neural Static** — exhaust / silence / tempo deny
2. **Ancient Hive** — stealth finishers
3. **Neural Stasis** (card set) — multi-turn exhaust, mass exhaust, stealth aura location

### Network control tools (shared)
- Satellite Jammer, Emergency Broadcast, Global Surveillance (notebook designs)

**Implementation rule:** Prefer **mapping to existing 240-card pool + curated decks** first; add notebook cards only when engine text is expressible (or after a small effects extension).

---

## Campaign structure

### Global: Investigation Board
- Faction chapter select (start with **Illuminati** vertical slice)
- Node types: Combat · Crisis (survive N turns) · Safe House (prune/buff/discover) · Boss · Story (comic panels)
- Progress saved locally (no accounts)

### Chapter A — Illuminati (example from notebook — **first build**)

#### Board 1: City Initiation
- Comic intro: watched / selected by organization
- Premade Network-heavy starter deck
- Recruiter coach dialogue (reuse Recruiter voice)
- Easy combat nodes (curve AI)
- Boss: initiation win → cutscene Templar ambush → **Escape crisis** (survive 5 turns; Recruiter dies in story)

#### Board 2: Illuminati HQ
- Training nodes introduce Taunt, Influence/discard-copy tools
- At “final” node: Templars assault HQ
- **Reverse progression:** cleared nodes reactivate as Templar fights
- Zone twist (e.g. Templars +1 Health) — mild
- Boss: Templar Grandmaster (walls + clears)
- Reward (v1): ledger entries + starter-deck upgrade flag; pack UI stub only

### Later chapters (design only until Illuminati ships)
- **Templars — Vault of Faith** — twist Hallowed Ground; boss Guardian of the Seal
- **Reptilians — Psionic Hive** — twist Static Air; boss Psionic Slaver
- Cross-faction Global Conspiracy Map linking wings (post-v1)

### Crisis examples (reusable templates)
- **The Blackout** — start at 10 energy, randomized high curves
- **Neural Static** — no spells for 3 turns
- **Escape** — survive N turns

---

## Difficulties

| Mode | Intent | Mechanical knobs (v1) |
|------|--------|------------------------|
| Normal | Story | Easy→Medium AI, starter buckets generous |
| Heroic | Prestige | Hard AI, boss HP+, leaner rewards |
| Anomaly | Chaos | + random run modifier from a small table |

Currency/packs: **hooks only** (achievement flags, `reward_stub` fields). No shop UI until a later phase.

---

## Feasibility vs current engine (Aug 2026)

**Already strong:** discard, silence, stealth, taunt, heal, mind control-ish, draw, locations, Hard 2-ply AI, encounters.json, Dossier, serializer.

**Gaps / hard notebook cards:**
| Idea | Issue |
|------|--------|
| Exhaust for two turns / mass exhaust no-refresh | No first-class multi-turn exhaust system today |
| Opponent discards → add Fragmented Thought tokens | Needs token card + discard trigger location |
| Look at 3 in opponent deck / choose | Needs scry UI + API |
| See top of both decks + bottom once/turn | New location verb + UI |
| Opponent next spell costs (2) more | Cost-modifier aura not general |
| Survive N turns win condition | Needs alternate win rule in `Game` / session |
| Zone twists | Global modifiers layer |
| Reverse node graph | Campaign state machine (new) |
| Comic cutscenes | Frontend sequence player (new assets optional) |
| Safe House deck mutate mid-run | Run deck state outside standard match |

**v1 principle:** Ship **map + nodes + existing cards/AI + one crisis wincon + mild twist**, not every notebook card on day one.

---

## Delivery slices (agent team)

1. **Campaign design freeze** — this brief + `docs/design/sp_campaign.md`
2. **Content map** — map notebook archetypes → existing card IDs; gap list for new cards
3. **Data model** — `data/campaign/illuminati.json` schema (boards, nodes, twists, dialogue)
4. **Engine: crisis + twist hooks** — survive-N; simple global buff
5. **Server/session** — campaign run CRUD, start node match
6. **UI: Investigation Board** — nodes, simple comic text panels
7. **Illuminati Board 1 playable**
8. **Board 2 reverse + twist**
9. **Ledger unlocks**
10. **Control deck presets** (constructed) in parallel if capacity
11. Deferred: currency, packs, full 3 chapters, Anomaly table polish

---

## Non-goals (now)

- Multiplayer / accounts / matchmaking  
- Full economy and booster opening  
- Every notebook card at full fidelity  
- Replacing vs AI / deck builder (they stay)  
- Pixel-perfect comic art (text/panel stubs OK)

---

## Open questions for human

1. Campaign **before** remaining Phase 9 QoL (shortcuts etc.), or QoL in parallel on a short track?
2. Comic panels: text-only stubs vs real panel art pipeline?
3. Starter deck: pure Network vs Illuminati-lite hybrid?
4. Keep First Contact mandatory once, optional, or fold into City Board 1 only?
