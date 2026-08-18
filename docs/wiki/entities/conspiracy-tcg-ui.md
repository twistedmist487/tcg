---
title: Conspiracy TCG — Play table UI
created: 2026-08-17
updated: 2026-08-17
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
│ HISTORY      │  OPPONENT HERO  (portrait + ♥)   │ ENERGY WELL     │
│ last 5 lines │  opponent hand (face-down)       │ 10 sockets      │
│              │  enemy board (max 7)             │                 │
│ DOSSIER      │                                  │ PLAY / START    │
│ hover/click  │  combat stage (oval table)       │ END TURN        │
│ art+effect   │                                  │ DECK + count    │
│ + flavor     │  YOUR HERO  (portrait + ♥)       │ MENU            │
│              │  your board (max 7)              │                 │
│ LOCATIONS    │                                  │                 │
│ enemy, yours │                                  │                 │
├──────────────┴──────────────────────────────────┴─────────────────┤
│                    YOUR HAND  (fan, max 10)                       │
└───────────────────────────────────────────────────────────────────┘
```

- **History** — newest five log lines (`addLog` drops older).
- **Dossier** — hover previews a card; click or Play pins it. Art, cost, name, type, stats, effect (keywords **bold**), italic lore. Opponent backs do not inspect.
- **Locations** — one plaque per player on the left rail (`Yours` / `Enemy`). Empty slots still use the plaque.
- **Hero frames** — circular faction commander + gold ring, name under the portrait, `♥ life` beside it. No wide name/life bars. Face targeting still uses `.player-header`.
- **Energy** — ten sockets for the human player's type. Lit = unspent, dark unlocked = spent, dim locked = not yet gained.
- **Hand** — fan, max 10. Unaffordable cards stay opaque and only desaturate (not 42% fade). Lifted card scales up.
- **Opponent hand** — face-down faction backs, 56×86, full opacity.

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
| `chrome/panel-rail.jpg` | Slim left and right rails |
| `chrome/location-slot.jpg` | Location plaques |
| `energy/influence.jpg` | Lit Influence |
| `energy/faith.jpg` | Lit Faith |
| `energy/psionics.jpg` | Lit Psionics |
| `energy/empty.jpg` | Spent or locked socket |
| `buttons/end-turn-normal.jpg` | Hourglass End Turn |
| `buttons/end-turn-hover.jpg` | Hover |
| `buttons/end-turn-pressed.jpg` | Pressed |
| `heroes/hero-frame.jpg` | Ornate badge (authoring; live ring is CSS) |
| `heroes/portrait-illuminati.jpg` | Hooded commander |
| `heroes/portrait-templars.jpg` | Knight commander |
| `heroes/portrait-reptilians.jpg` | Reptilian commander |
| `static/cards/fronts/{faction}-front.jpg` | Card art plate |
| `static/cards/backs/{faction}-back.jpg` | Deck pile and opponent hand |

`chrome/nameplate*.jpg` is leftover banner HUD. The live match does not use it.

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
