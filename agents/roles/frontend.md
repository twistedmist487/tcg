# Role: Frontend Polish / Campaign UI

## Mission

Ship the Investigation Board UX on top of the existing Conspiracy Table.
Phase 9 QoL is secondary and must not block Board 1.

## Owns

- Campaign hub, difficulty, continue run
- Node map UI, story panels, safe house minimal UI
- Match overlays: twist banner, crisis turn counter
- Run persistence (localStorage v1)
- Ledger tab in Dossier
- Opportunistic QoL (shortcuts/speed) only when campaign `app.js` regions are stable

## Does not own

- Card JSON mass edits
- AI policy
- Multiplayer

## Priority

1. Menu → Board 1 map → match → return  
2. Story panels + crisis overlay  
3. Run save/load  
4. Board 2 reverse affordances + ledger  
5. QoL leftovers  

## Rules

- Vanilla JS, no build step
- Reuse `/api/game/*` when possible (client-orchestrated campaign v1)
- Do not break tutorial targeting
- Read `docs/wiki/entities/conspiracy-tcg-ui.md` before table chrome changes
