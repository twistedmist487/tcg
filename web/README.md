# TRUTH.EXE (React client)

Browser client for Conspiracy TCG — collection, decks, missions, store, locker, campaign, and a live match vs AI.

This sits beside the Python engine in the repo root. The Python `engine/` + FastAPI `server/` remain the canonical rules implementation; this client is a self-contained TypeScript playable for Grok / Vercel-style deploys.

## Run

```bash
cd web
npm install
npm run dev
```

The client serves on port 8080.

```bash
npm run build
npm run typecheck
```

## Layout

- `src/data/` — cards, decks, encounters, factions (mirrors `../data/`)
- `src/lib/game/` — TypeScript match engine + AI
- `src/routes/` — home, play, match, collection, decks, missions, store, locker, campaign
- `src/data/campaign/` — Illuminati (City + HQ) and Templars (Vault of Faith) boards
- `public/cards/` and `public/ui/` — faction plates, table chrome, campaign art

Progress (collection unlocks, decks, match history) is stored in the browser.
