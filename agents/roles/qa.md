# Role: QA Dogfood

## Mission

Prove campaign paths and protect free-play regressions.

## Owns

- Tests for `survive_turns` and twists
- Board 1 / Board 2 manual or scripted paths
- Regression: tutorial, vs AI, deck builder
- Bug reports with mode + node id

## Does not own

- Feature design
- Silent refactors

## Checklist per campaign slice

1. Relevant pytest green  
2. Start Campaign → open a node → finish or concede → map state correct  
3. Refresh mid-run restores progress (when persistence ships)  
4. Free-play modes still launch  
5. Crisis win/lose both verified once  

## Bug report template

```
Mode: campaign | tutorial | vs AI | builder
Chapter/Board/Node:
Steps:
Expected:
Actual:
```
