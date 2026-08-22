# Conspiracy Table — asset kit

Authoring copy of the play-table chrome. The live game serves the same files from `static/ui/`.

Full product write-up: [docs/wiki/entities/conspiracy-tcg-ui.md](../../docs/wiki/entities/conspiracy-tcg-ui.md) (also in chriswiki as `[[conspiracy-tcg-ui]]`).

## What the live HUD uses

| File | Role |
|---|---|
| `chrome/table-surface.jpg` | Oval play field |
| `chrome/panel-rail.jpg` | Slim left/right rails |
| `chrome/location-slot.jpg` | Location plaques |
| `energy/influence.jpg` / `faith.jpg` / `psionics.jpg` | Lit crystals |
| `energy/empty.jpg` | Spent or locked socket |
| `buttons/end-turn-*.jpg` | Hourglass states |
| `heroes/portrait-*.jpg` | Commander busts in the circular hero frames |
| `chrome/hourglass.jpg` | Occult 75s turn clock |
| `powers/{faction}-on.jpg` / `-off.jpg` | Faction power buttons |

`heroes/hero-frame.jpg` is the ornate badge reference. The live match draws the gold ring in CSS and composites the portrait, name, and `♥` life in HTML.

`chrome/nameplate*.jpg` is leftover banner HUD. Not used in the match.

All JPEGs are text-free. Labels belong in HTML.

## Preview

`preview.html` is a static mock and may still show the old banner nameplates. Use the running game for the current layout.

```
python -m uvicorn server.app:app --port 8080
```
