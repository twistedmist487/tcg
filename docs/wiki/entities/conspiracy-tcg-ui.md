---
title: Conspiracy TCG — Play table UI
created: 2026-08-17
updated: 2026-08-22
type: entity
tags: [project, gaming, conspiracy, status]
sources: []
confidence: high
contested: false
---

# Conspiracy TCG — Play table UI

Browser match HUD for [[conspiracy-tcg]]. Vanilla JS, no build step. The engine stays UI-free; the SPA reads `game.get_state()` and posts to `/api/game/{id}/...`.

**Live files:** `static/index.html`, `static/style.css`, `static/app.js`  
**Art:** `static/ui/` (served) — authoring copy in `assets/ui-table/`  
**Repo wiki:** `docs/wiki/entities/conspiracy-tcg-ui.md`

## Screens

| Screen | ID | Role |
|---|---|---|
| Main menu | `screen-menu` | Tutorial, vs AI, encounters, deck builder, How to Play |
| Vs AI setup | `screen-setup` | Name, factions, Easy/Medium, decks |
| Encounters | `screen-encounters` | Scripted showcase matchups |
| Deck builder | `screen-deck` | 30-card list, faction + Network pool |
| How to Play | `screen-help` | Rules copy |
| Mulligan | `screen-mulligan` | One redraw before a normal match |
| Match | `screen-game` | Conspiracy Table |

## Match layout

```
┌──────────────┬──────────────────────────────────┬─────────────────┐
│ HISTORY      │  OPPONENT TRAY (hand | hero | ⚡♥)│ ENERGY WELL     │
│ last 5 lines │  enemy minions (7 oval slots)    │ 10 sockets      │
│              │  ──── hourglass 75s clock ────   │                 │
│ DOSSIER      │  your minions (7 oval slots)     │ PLAY / START    │
│ hover/click  │  YOUR TRAY (♥⚡ | hero | field)   │ END TURN        │
│ art+effect   │                                  │ DECK + count    │
│ + flavor     │                                  │ (Recycle drop)  │
│ LOCATIONS    │                                  │ MENU            │
│ enemy, yours │                                  │                 │
├──────────────┴──────────────────────────────────┴─────────────────┤
│                    YOUR HAND  (fan, drag onto table)              │
└───────────────────────────────────────────────────────────────────┘
```

- **Drag** — drag a hand card onto the table (or a target) to play. Drag a ready character onto an enemy minion or the enemy hero to attack. Click still works (tutorial, mobile tap). Recycle: drag onto the deck well.
- **History** — newest five log lines (`addLog` drops older).
- **Dossier** — hover previews a card; click or Play pins it. Art, cost, name, type, stats, effect (keywords **bold**), italic lore. Opponent backs do not inspect. Faction powers use the same inspector.
- **Locations** — one plaque per player on the left rail (`Yours` / `Enemy`). Empty slots still use the plaque.
- **Hero frames** — each commander sits in a wide wooden HUD tray that spans the oval: hand (or life) on one wing, framed portrait on a faction nameplate in the center, life orb + **faction power button** + role on the other. The player tray also shows a 7-pip field meter. Face targeting still uses `.player-header`.
- **Faction powers** — cost 2, once per turn. Active/inactive JPEGs in `static/ui/powers/`. Grey until you can afford it. Illuminati Pull Strings (1 to any), Templars Call Initiate (1/1 Taunt), Reptilians Psi Lash (2 face).
- **Turn clock** — 75 seconds on your turn (`#turn-timer` + occult hourglass). At 10s the count goes red and larger than the glass. At 0 the turn ends. Skip a turn with no card/board touch and the next clock starts at 10s until you interact, then the remaining 75s from this turn’s start resume.
- **Combat juice** — attackers lunge, damage/heal numbers float, buffs flash green, debuffs flash red, deaths fade, leftover minions pack to the center. AI plays flip face-up from the hand onto the field (`POST /ai-step`).
- **Energy** — ten sockets for the human player's type. Lit = unspent, dark unlocked = spent, dim locked = not yet gained.
- **Hand** — fan, max 10. Unaffordable cards stay opaque and only desaturate (not 42% fade). Lifted card scales up. Drag onto the table to play.
- **Board minions** — oval portraits with large attack (left) and health (right). Empty boards still show 7 dashed slot silhouettes so the battlefield fills the occult oval.
- **Opponent hand** — small stacked faction backs beside the enemy hero.

## Look

- Background `#0f0f14`, gold `#c8a84e`
- Illuminati `#8e44ad`, Templars `#f39c12`, Reptilians `#1abc9c`
- Body/UI: Source Sans 3. Titles and hero names: Cinzel
- Card rules on a cream panel. Keywords via `formatRulesHtml()` → `<strong class="kw-word">`
- Board minis hide the type line so name, keywords, and stats stay inside the frame
- Generated JPEGs are text-free. Names, costs, life, and rules are HTML

## Asset map (`static/ui/`)

| Path | Used for |
|---|---|
| `chrome/table-surface.jpg` | Oval play field |
| `chrome/nameplate.jpg` | Name banner under each commander (neutral) |
| `chrome/nameplate-*.jpg` | Faction name banners |
| `chrome/panel-rail.jpg` | Slim left and right rails |
| `chrome/location-slot.jpg` | Location plaques |
| `energy/influence.jpg` | Lit Influence |
| `energy/faith.jpg` | Lit Faith |
| `energy/psionics.jpg` | Lit Psionics |
| `energy/empty.jpg` | Spent or locked socket |
| `buttons/end-turn-normal.jpg` | Hourglass End Turn |
| `buttons/end-turn-hover.jpg` | Hover |
| `buttons/end-turn-pressed.jpg` | Pressed |
| `heroes/hero-frame.jpg` | Gold ring around commander portraits |
| `heroes/portrait-illuminati.jpg` | Hooded commander |
| `heroes/portrait-templars.jpg` | Knight commander |
| `heroes/portrait-reptilians.jpg` | Reptilian commander |
| `chrome/hourglass.jpg` | 75s turn clock |
| `powers/{faction}-on.jpg` | Ready faction power |
| `powers/{faction}-off.jpg` | Spent / unaffordable faction power |
| `static/cards/fronts/{faction}-front.jpg` | Card art plate |
| `static/cards/backs/{faction}-back.jpg` | Deck pile and opponent hand |

`chrome/nameplate*.jpg` is the name banner under each commander portrait.

## How the Dossier gets text

1. Hand cards already include `lore` and `ability` / `effect` in `get_state()`.
2. Board and location payloads include `id`, `type`, `lore`, and `ability` / `effect`.
3. `resolveInspectCard()` merges the live instance with `/api/cards`.

Change JSON, not the art files.

## Key front-end functions

| Function | Role |
|---|---|
| `render()` | Paint the table from `state` |
| `renderCardFace()` | Card chrome + bold keywords |
| `renderLocation()` | Left-rail plaques |
| `renderEnergyWell()` / `renderDeckWell()` | Right rail |
| `paintHeroFrame()` | Faction class + portrait |
| `paintPowerButton()` | Active / inactive faction power |
| `syncTurnClock()` | 75s / 10s AFK hourglass |
| `animateCombat()` / `flyFromOpponentHand()` | Lunges, pops, AI fly-ins |
| `showDossier()` / `setupDossierInteractions()` | Hover / pin |
| `addLog()` | History, cap 5 |

Deck remaining count is `#deck-remaining` (not the deck-builder `#deck-count`).

## Replacing an asset

1. Author the JPEG in `assets/ui-table/` (no text).
2. Copy to the same path under `static/ui/`.
3. Rails fill the file edge-to-edge; crystals stay 1:1; End Turn states share one crop.
4. Recurring subjects (commander, table wood): edit from the existing file.

## Related

- [[conspiracy-tcg]] — project status and how to run
- [[conspiracy-tcg-cards]] — printed card tables
- [[chris]] — owner / project map
