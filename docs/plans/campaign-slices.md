# Campaign expansion slices

Locked pattern from **The Inner Circle** (City → HQ reverse). Vault of Faith and Psionic Hive are Board 1 only. Each remaining faction chapter gets the same second board before any new systems.

Auth (CLAIM ARCHIVE) is shipped. Guest play stays open. Economy / packs stay deferred.

```
SHIPPED
  First Contact (optional)
  Illuminati  Board 1 City + crisis + Board 2 HQ reverse + Grandmaster
  Templars    Board 1 Vault (Hallowed Ground, Guardian)
  Reptilians  Board 1 Hive (Static Air, Slaver)
  Cosmetics / field cards / Heroic per Board 1
  CLAIM ARCHIVE (optional Google / X bind)

NEXT (in order)
  7  Templars Board 2 — Crypt Reverse
  8  Reptilians Board 2 — Inner Hive Reverse
  9  Reckless + crisis parity (Vault + Hive)
  10 The Circle Closes (crossover finale)
  11 Replay layer (NG+, constructed presets, cosmetics for Board 2)

LATER
  Network as a playable chapter (not a fourth starter)
  Packs / shop
  Handle editor, export/import file
```

## The Board 2 template (do not invent a new structure)

Copy HQ. Change faction, coach, twist, and the three train keywords.

| Slot | Illuminati HQ (canonical) | Templars Crypt Reverse | Reptilians Inner Hive |
|---|---|---|---|
| Arrival story | The Lodge / Ops | The Crypt Opens / Chaplain | The Comb Tightens / The Voice |
| Train 1 | Mute Chamber — Silence | Ossuary — Recur / Crypt Warden | Venom Pit — Fang Brood |
| Train 2 | Burn Room — Discard | Reliquary Ward — Shielding + heal | Skin Walk — Mimic / +2+2 stealth |
| Train 3 | Soft Exile — Bounce | Nave Battery — Charge / Zealot | Thought Tax — spell-cost or steal Psionics |
| Safehouse | Black Budget Armory | Relic Vault (add / inject / prune / skip reverse) | Molting Chamber |
| Breach story | Templars hit the sanctum (`triggers_reverse`) | Illuminati heist team inside (`triggers_reverse`) | Abductors at the visor (`triggers_reverse`) |
| Reverse | Fight back out, kit is live, twist on | Same | Same |
| Chapter boss | Grandmaster, Fortitude, 24 | Heist Hierophant (Illuminati control), new twist **Liquid Assets** or **Puppet Mandate** | Hive Queen / Overlord Sskrath, twist **Neural Static** (unspent energy becomes a 1/1) or keep Static Air + steal |
| Coach | Ops | Chaplain | Voice |
| Heroic | +2 enemy life, keep twist | same | same |
| Reckless | skip Safe Drop on City | skip Vestry | skip Molt |

Engine already has: reverse_order, triggers_reverse, boss_requires_reverse_clear, run kit, armory inject, skip_reverse_node, EOT silence, Hallowed Ground, Static Air, survive_turns crisis, Heroic.

New work is almost all **JSON + art + 1–2 twist hooks**, not a new campaign machine.

---

## Slice 7 — Crypt Reverse (Templars Board 2)

**Unseal:** `vaultCleared`. City/HQ stay as they are.

**Board id:** `crypt` (`board_crypt.json`). Chapter `templars.boards = ["vault", "crypt"]`.

**Nodes**

1. `crypt_arrival` story — The seal held. The heist did not leave. Chaplain takes you under the nave.
2. `train_recur` combat teach Recur (Crypt Warden). AI 12. Scripted opener.
3. `train_shield` combat teach Shielding + Field Medic. AI 12.
4. `train_charge` combat teach Charge face (Zealot). AI 14.
5. `relic_vault` safehouse — add Knight Commander / Healing Seraph / prune / skip `train_charge` (Puppet-Master analogue: "break the stair").
6. `crypt_breach` story `triggers_reverse` — Inner Circle auditors in the ossuary. Reverse the three trains as Illuminati lists.
7. `hierophant` boss 24, run kit, twist **Liquid Assets** (when you discard, +1 energy next turn) *or* if that hook is too much, reuse Fortitude flipped onto the player (first enemy body each turn is blessed — they stole the seal). Prefer Liquid Assets: Templars don't discard much, the heist deck does, so the twist teaches the enemy.

**Crisis on Vault Board 1 (small add in this slice or slice 9):** `vigil` survive 5 after Guardian, then enter Crypt. Mirrors Traitor's Toll. If we skip it here, Crypt starts from a story node on Vault clear the way City used `next_board`.

**Rewards:** field cards (Warden of Secrets, Grand Master Aldric), sleeve `back-crypt`, plate `plate-crypt`, title CRYPT WRIGHT, Heroic title SEALBREAKER. Flag `cryptCleared` / `cryptHeroicCleared`.

**Art:** crypt-board 16:9 overhead, Chaplain already exists, new Hierophant portrait, 3 story stills (ossuary, relic vault, breach).

**QA:** Recur actually returns; Shielding pops once; reverse kit includes Vestry pick; Heroic keeps Hallowed Ground from Vault if we carry the run flag, else Crypt has its own twist only.

---

## Slice 8 — Inner Hive Reverse (Reptilians Board 2)

**Unseal:** `hiveCleared`.

**Board id:** `nest` (`board_nest.json`).

**Nodes**

1. `nest_arrival` story — Slaver is down. The comb does not go quiet. The Voice goes deeper.
2. `train_venom` combat teach Venom (Fang Brood).
3. `train_mimic` combat teach Mimic stealth +2/+2.
4. `train_leech` combat teach Psionic Leech (attack face, steal energy).
5. `queen_chamber` safehouse — add Overlord / Apex / prune / skip `train_leech`.
6. `nest_breach` story `triggers_reverse` — Templar purge team with incense and shotguns. Reverse trains as Faith lists.
7. `queen` boss 24, Overlord Sskrath list, twist **Static Air stays** plus **Brood Pressure** (each time a friendly dies, the enemy hero gains 1 life) *or* keep Static Air only and raise life to 26. Prefer one new hook max.

**Rewards:** field cards (Overlord, Apex Stalker), sleeve `back-nest`, title QUEENKILLER on Heroic. Flag `nestCleared` / `nestHeroicCleared`.

**Art:** nest-board 16:9, Queen portrait, 3 stills.

**QA:** Venom kills at 1 remaining; Mimic stats on enter; reverse kit includes Molt pick; Static Air counter visible on reverse fights.

---

## Slice 9 — Reckless + crisis parity

Vault and Hive Board 1 are missing the City extras that make HQ feel earned.

| Add | Vault | Hive |
|---|---|---|
| Crisis after boss | `last_watch` survive 5 (incense flood) | `abduct` survive 5 (tractor dark) |
| Reckless skip | skip Vestry → flag `skipped_vestry` | skip Molt → `skipped_molt` |
| Reckless cosmetics | title OATHBREAKER | title SKINLESS |
| Story variants | `story_panels_reckless` on Crypt arrival | same on Nest arrival |

Engine: `survive_turns` and skip flags already exist. This slice is JSON + two cosmetics + banner copy.

Do **not** invent a third difficulty. Heroic is the hard path. Reckless is the greedy path.

---

## Slice 10 — The Circle Closes

Only after all three Board 2s.

One short board, player picks the faction kit they finished last (or Locker loadout + active deck). Nodes:

1. Story — three coaches in one room, they hate this
2. Combat vs a mixed Network list (teach nothing; this is a test)
3. Safehouse — one card from each faction's field pool
4. Boss **The Archive** (30, silent coach, no teach) — uses Fortitude + Static Air together, or a new **Black Room** twist (you play with the top card of your deck revealed)

Unlock: `cryptCleared && nestCleared && chapterCleared`.

Reward: sleeve `back-heroic` already exists for Inner Circle Heroic — add `felt-circle`, title ARCHIVE_WALKER. This is the cosmetic that says you finished the spine.

---

## Slice 11 — Replay, not new boards

- NG+: start a chapter with the **run kit you finished**, not the starter. Flag `ngPlus`. Enemy life +2 on top of Heroic if both.
- Constructed presets from `sp_campaign.md` §7 (shadow mandate, iron cathedral, neural static) — free play, not campaign.
- Board 2 cosmetics already granted in 7/8; Locker filter by chapter.
- Optional: bind-file export JSON on Locker (same blob as CLAIM ARCHIVE). Cheap, useful even unsigned.

---

## What we will not do in these slices

- Packs, credits shop, real-money
- Ranked PvP (P2P can stay as a toy)
- A fourth starter faction (Network stays hired)
- New campaign state machine (no extra phases beyond forward / reverse / boss)
- Rewriting City or First Contact
- Server-authoritative inventory

---

## Per-slice definition of done

Same bar as Hive / Vault:

1. Board JSON + starter/scripted lists valid
2. Twist hook in `engine.ts` if new, with heroic spread
3. Coach / art / kicker / ledger / NODE_FIRST_CLEAR
4. Hub seal + ChapterCompleteBanner + missions row
5. Cosmetics unlock rule + Locker tiles
6. Play the teach fights and the boss once
7. Typecheck + production smoke
8. Push `twistedmist487/tcg`

---

## Suggested next command

**Proceed with slice 7 (Crypt Reverse).** It is the largest remaining hole: Templars have a teach board and no siege. Hive reverse waits until the Crypt pattern is proven a second time.
