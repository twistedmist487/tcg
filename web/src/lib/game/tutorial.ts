import { getEncounter, resolveCard } from "./catalog";
import type { CardInst, EncounterStep, MatchState } from "./types";

export type CoachHighlight = {
  handNames: string[];
  endTurn: boolean;
  enemyIids: string[];
  readyAllies: boolean;
  location: boolean;
  face: boolean;
};

export type Coach = EncounterStep & { highlight: CoachHighlight };

const EMPTY_HIGHLIGHT: CoachHighlight = {
  handNames: [],
  endTurn: false,
  enemyIids: [],
  readyAllies: false,
  location: false,
  face: false,
};

export function initialTutorialStep(encounterId: string): string | null {
  const enc = getEncounter(encounterId);
  return enc?.steps?.[0]?.id ?? null;
}

function nameOf(c: CardInst) {
  return resolveCard(c.cardId)?.name ?? "";
}

function hasNamed(cards: CardInst[], name: string) {
  return cards.some((c) => nameOf(c) === name);
}

function playedNamed(prev: MatchState, next: MatchState, name: string) {
  return hasNamed(prev.player.hand, name) && !hasNamed(next.player.hand, name);
}

function playerAttacked(prev: MatchState, next: MatchState) {
  if (next.player.board.some((c) => c.attackedThisTurn > 0)) return true;
  if (prev.player.board.length > next.player.board.length) return true;
  const line = next.log[0] ?? "";
  return /^(Trade: |.* strikes the handler)/.test(line);
}

function backToPlayer(prev: MatchState, next: MatchState) {
  return next.phase === "main" && next.current === "player" && (prev.current === "ai" || prev.phase === "ai" || next.turn > prev.turn);
}

function visibleTaunts(state: MatchState) {
  return state.ai.board.filter((m) => m.taunt && !m.stealth);
}

export function advanceTutorial(prev: MatchState, next: MatchState): string | null {
  const step = prev.tutorialStep;
  if (!step || next.phase === "over") return step;
  if (prev.encounterId === "tutorial") return advanceFirstContact(prev, next, step);
  if (prev.encounterId === "keyword_lab") return advanceLab(prev, next, step);
  return step;
}

function advanceFirstContact(prev: MatchState, next: MatchState, step: string): string {
  if (step === "welcome") {
    if (hasNamed(next.player.board, "Squire") || next.player.board.length > prev.player.board.length) {
      return "exhaustion";
    }
  }
  if (step === "exhaustion") {
    if (backToPlayer(prev, next) && next.turn >= 2) return "attack";
  }
  if (step === "attack") {
    if (playerAttacked(prev, next)) {
      if (next.ai.board.some((c) => c.cardId === "neutral_char_008")) return "deathrattle";
      if (visibleTaunts(next).length) return "taunt";
      return "spell";
    }
  }
  if (step === "deathrattle") {
    if (visibleTaunts(next).length) return "taunt";
    if (backToPlayer(prev, next)) return visibleTaunts(next).length ? "taunt" : "spell";
    if (playedNamed(prev, next, "Divine Smite")) return "location";
  }
  if (step === "taunt") {
    if (playedNamed(prev, next, "Divine Smite")) return "location";
    if (visibleTaunts(next).length === 0 && visibleTaunts(prev).length > 0) return "spell";
    if (backToPlayer(prev, next) && visibleTaunts(next).length === 0) return "spell";
  }
  if (step === "spell") {
    if (playedNamed(prev, next, "Divine Smite")) return "location";
    if (playedNamed(prev, next, "Sacred Chapel") || next.player.location) return "charge";
  }
  if (step === "location") {
    if (next.player.location) return "charge";
    if (playedNamed(prev, next, "Zealot") || hasNamed(next.player.board, "Zealot")) return "charge";
  }
  if (step === "charge") {
    const zealot = next.player.board.find((c) => nameOf(c) === "Zealot");
    if (zealot && zealot.attackedThisTurn > 0) return "free";
    if (hasNamed(prev.player.board, "Zealot") && !zealot && playerAttacked(prev, next)) return "free";
    if (playedNamed(prev, next, "Zealot") && !zealot) return "free";
  }
  return step;
}

function advanceLab(prev: MatchState, next: MatchState, step: string): string {
  if (step === "recycle" && (playedNamed(prev, next, "Burn Bag") || next.log[0]?.includes("Recycle"))) {
    return "split";
  }
  if (step === "split" && playedNamed(prev, next, "Forked Brief")) return "drain";
  if (step === "drain" && hasNamed(next.player.board, "Leech Contact")) return "drain-attack";
  if (step === "drain-attack") {
    const leech = next.player.board.find((c) => nameOf(c) === "Leech Contact");
    if (leech && leech.attackedThisTurn > 0) return "ward";
    if (backToPlayer(prev, next) && hasNamed(next.player.hand, "Quiet Vest")) return "ward";
  }
  if (step === "ward" && (playedNamed(prev, next, "Quiet Vest") || next.player.board.some((c) => c.ward))) {
    return "free";
  }
  return step;
}

export function coachFor(state: MatchState): Coach | null {
  if (!state.tutorialStep || state.phase === "over" || state.phase === "mulligan") return null;
  const enc = getEncounter(state.encounterId);
  const step = enc?.steps?.find((s) => s.id === state.tutorialStep);
  if (!step) return null;
  return { ...step, highlight: highlightFor(state, step.id) };
}

function highlightFor(state: MatchState, id: string): CoachHighlight {
  const h = { ...EMPTY_HIGHLIGHT, handNames: [] as string[], enemyIids: [] as string[] };
  const ready = state.player.board.filter((m) => !m.exhausted && m.atk > 0);
  const taunts = visibleTaunts(state);
  const enemies = state.ai.board.filter((m) => !m.stealth);
  if (id === "welcome") h.handNames = ["Squire"];
  if (id === "exhaustion") h.endTurn = state.current === "player" && state.phase === "main";
  if (id === "attack") {
    h.readyAllies = ready.length > 0;
    h.enemyIids = enemies.map((m) => m.iid);
    h.face = taunts.length === 0;
  }
  if (id === "deathrattle") {
    h.enemyIids = state.ai.board.filter((c) => c.cardId === "neutral_char_008").map((m) => m.iid);
  }
  if (id === "taunt") {
    h.readyAllies = ready.length > 0;
    h.enemyIids = taunts.map((m) => m.iid);
  }
  if (id === "spell") {
    h.handNames = ["Divine Smite"];
    h.enemyIids = enemies.map((m) => m.iid);
  }
  if (id === "location") {
    h.handNames = ["Sacred Chapel"];
    h.location = true;
  }
  if (id === "charge") {
    if (hasNamed(state.player.hand, "Zealot")) h.handNames = ["Zealot"];
    const z = state.player.board.find((c) => nameOf(c) === "Zealot" && !c.exhausted);
    if (z) {
      h.readyAllies = true;
      h.enemyIids = (taunts.length ? taunts : enemies).map((m) => m.iid);
      h.face = taunts.length === 0;
    }
  }
  if (id === "recycle") h.handNames = ["Burn Bag"];
  if (id === "split") h.handNames = ["Forked Brief"];
  if (id === "drain") h.handNames = ["Leech Contact"];
  if (id === "drain-attack") h.readyAllies = hasNamed(state.player.board, "Leech Contact");
  if (id === "ward") h.handNames = ["Quiet Vest"];
  return h;
}

export function finishPatch(prev: MatchState, next: MatchState): MatchState {
  next.tutorialStep = advanceTutorial(prev, next);
  return next;
}
