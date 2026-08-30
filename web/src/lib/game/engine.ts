import {
  INITIATE,
  keywordsOf,
  resolveCard,
  rulesText,
} from "./catalog";
import type {
  CardDef,
  CardInst,
  MatchState,
  PendingTarget,
  SideId,
  SideState,
} from "./types";

function mulberry32(a: number) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function log(state: MatchState, line: string) {
  state.log = [line, ...state.log].slice(0, 8);
}

function nextIid(state: MatchState): string {
  state.nextIid += 1;
  return `c${state.nextIid}`;
}

function makeInst(state: MatchState, def: CardDef, ready = false): CardInst {
  const kws = keywordsOf(def);
  const charge = kws.includes("Charge");
  const rush = kws.includes("Rush");
  return {
    iid: nextIid(state),
    cardId: def.id,
    atk: def.attack ?? 0,
    hp: def.health ?? 1,
    maxHp: def.health ?? 1,
    exhausted: ready ? false : !(charge || rush),
    stealth: kws.includes("Stealth"),
    taunt: kws.includes("Taunt"),
    charge,
    rush,
    venom: kws.includes("Venom"),
    drain: kws.includes("Drain"),
    shielding: kws.includes("Shielding"),
    ward: kws.includes("Ward"),
    silenced: false,
    enraged: kws.includes("Enraged"),
    attackedThisTurn: 0,
  };
}

function sideOf(state: MatchState, id: SideId): SideState {
  return id === "player" ? state.player : state.ai;
}

function otherOf(id: SideId): SideId {
  return id === "player" ? "ai" : "player";
}

function findOnBoard(side: SideState, iid: string): CardInst | undefined {
  return side.board.find((c) => c.iid === iid);
}

function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

function draw(state: MatchState, id: SideId, n = 1) {
  const side = sideOf(state, id);
  for (let i = 0; i < n; i++) {
    if (side.deck.length === 0) {
      side.fatigue += 1;
      damageHero(state, id, side.fatigue);
      log(state, `${side.name} draws fatigue (${side.fatigue}).`);
      continue;
    }
    const cardId = side.deck.shift()!;
    const def = resolveCard(cardId);
    if (!def) continue;
    if (side.hand.length >= 10) {
      log(state, `${side.name} burned ${def.name} (hand full).`);
      continue;
    }
    side.hand.push(makeInst(state, def, true));
  }
}

function damageHero(state: MatchState, id: SideId, amount: number) {
  const side = sideOf(state, id);
  side.life -= amount;
  if (side.life <= 0) {
    side.life = 0;
    state.phase = "over";
    state.winner = otherOf(id);
    log(state, `${side.name} is down. Archive sealed.`);
  }
}

function healHero(state: MatchState, id: SideId, amount: number) {
  const side = sideOf(state, id);
  side.life = Math.min(30, side.life + amount);
}

function damageMinion(
  state: MatchState,
  owner: SideId,
  minion: CardInst,
  amount: number,
  venom = false,
) {
  if (amount <= 0) return;
  if (minion.ward) return;
  if (minion.shielding) {
    minion.shielding = false;
    return;
  }
  minion.hp -= amount;
  if (venom && amount > 0) minion.hp = 0;
  if (minion.hp <= 0) kill(state, owner, minion);
}

function kill(state: MatchState, owner: SideId, minion: CardInst) {
  const side = sideOf(state, owner);
  side.board = side.board.filter((c) => c.iid !== minion.iid);
  const def = resolveCard(minion.cardId);
  log(state, `${def?.name ?? "Asset"} is burned.`);
  const text = def ? rulesText(def) : "";
  if (/Deathrattle|when this character dies|summon a 2\/1 Raptor/i.test(text)) {
    summonToken(state, owner, "neutral_char_008");
  }
  if (def && !minion.silenced && /Recur/i.test(text)) {
    if (side.deck.length < 40) side.deck.push(def.id);
  }
}

function summonToken(state: MatchState, id: SideId, cardId: string, ready = false) {
  const side = sideOf(state, id);
  if (side.board.length >= 7) return;
  const def = resolveCard(cardId);
  if (!def) return;
  const inst = makeInst(state, def, ready);
  if (cardId === "neutral_char_008") {
    inst.atk = 2;
    inst.hp = 1;
    inst.maxHp = 1;
  }
  side.board.push(inst);
  log(state, `${side.name} summons ${def.name}.`);
}

function applyBattlecry(state: MatchState, id: SideId, inst: CardInst, def: CardDef) {
  if (inst.silenced) return;
  const text = rulesText(def);
  const enemy = otherOf(id);
  const self = sideOf(state, id);
  const foe = sideOf(state, enemy);

  const plus = text.match(/\+(\d+)\/\+(\d+)/);
  if (/when played/i.test(text) && plus) {
    inst.atk += Number(plus[1]);
    inst.hp += Number(plus[2]);
    inst.maxHp += Number(plus[2]);
  }

  const dmg = text.match(/deal (\d+) damage/i);
  if (dmg && /when played|battlecry/i.test(text)) {
    const n = Number(dmg[1]);
    if (/all enemy/i.test(text)) {
      for (const m of [...foe.board]) damageMinion(state, enemy, m, n);
      if (/hero|all enemies/i.test(text)) damageHero(state, enemy, n);
    } else if (foe.board.length) {
      const t = foe.board[0]!;
      damageMinion(state, enemy, t, n);
    } else {
      damageHero(state, enemy, n);
    }
  }

  if (/discard/i.test(text) && foe.hand.length) {
    const i = Math.floor(foe.hand.length * 0.37) % foe.hand.length;
    const gone = foe.hand.splice(i, 1)[0];
    const gdef = gone ? resolveCard(gone.cardId) : undefined;
    log(state, `${foe.name} discards ${gdef?.name ?? "a file"}.`);
  }

  const drawN = text.match(/draw (\d+)/i);
  if (drawN) draw(state, id, Number(drawN[1]));
  else if (/\bdraw a card\b/i.test(text) && /when played/i.test(text)) draw(state, id, 1);

  if (/silence/i.test(text) && foe.board[0]) {
    silence(foe.board[0]);
  }

  if (/restore (\d+)/i.test(text)) {
    const n = Number(text.match(/restore (\d+)/i)?.[1] ?? 0);
    healHero(state, id, n);
  }

  if (/summon a 1\/1 Initiate/i.test(text) || def.id === "token_initiate") {
    /* already the token */
  }
}

function silence(minion: CardInst) {
  minion.silenced = true;
  minion.stealth = false;
  minion.taunt = false;
  minion.charge = false;
  minion.rush = false;
  minion.venom = false;
  minion.drain = false;
  minion.shielding = false;
  minion.ward = false;
  minion.enraged = false;
}

function locationTick(state: MatchState, id: SideId, when: "start" | "end") {
  const side = sideOf(state, id);
  const loc = side.location;
  if (!loc) return;
  const def = resolveCard(loc.cardId);
  if (!def) return;
  const text = rulesText(def);
  const enemy = otherOf(id);
  if (when === "start") {
    if (/start of your turn/i.test(text) && /heal 1|restore 1/i.test(text)) {
      for (const m of side.board) {
        m.hp = Math.min(m.maxHp, m.hp + 1);
      }
      if (/hero/i.test(text)) healHero(state, id, 1);
    }
    if (/start of your turn/i.test(text) && /deal 1 damage to the enemy hero/i.test(text)) {
      const n = id === "player" && side.faction === "reptilians" && /Reptilians/i.test(text) ? 2 : 1;
      damageHero(state, enemy, n);
    }
    if (/draw a card/i.test(text) && /start of your turn|each turn/i.test(text)) {
      draw(state, id, 1);
    }
  }
  if (when === "end") {
    if (/end of your turn/i.test(text) && /draw a card/i.test(text)) draw(state, id, 1);
    if (/summon a 2\/1 Raptor/i.test(text) && /end of your turn/i.test(text)) {
      summonToken(state, id, "neutral_char_008", /Charge/i.test(text));
    }
  }
  if (/\+1 Attack/i.test(text) && /your/i.test(text)) {
    /* aura applied at combat */
  }
}

function auraAtk(state: MatchState, owner: SideId, minion: CardInst): number {
  const side = sideOf(state, owner);
  let bonus = 0;
  if (side.location) {
    const def = resolveCard(side.location.cardId);
    const text = def ? rulesText(def) : "";
    if (/\+1 Attack/i.test(text)) bonus += 1;
  }
  return minion.atk + bonus;
}

function legalAttackTargets(state: MatchState, attackerOwner: SideId, attacker: CardInst) {
  const enemy = sideOf(state, otherOf(attackerOwner));
  const taunts = enemy.board.filter((m) => m.taunt && !m.stealth);
  const vis = enemy.board.filter((m) => !m.stealth);
  if (taunts.length) return { minions: taunts, face: false };
  const face = !attacker.rush || attacker.attackedThisTurn > 0 || attacker.charge;
  return { minions: vis, face: attacker.rush && !attacker.charge ? false : face || vis.length === 0 };
}

export function startMatch(opts: {
  seed?: number;
  playerName: string;
  aiName: string;
  playerFaction: SideState["faction"];
  aiFaction: SideState["faction"];
  playerDeck: string[];
  aiDeck: string[];
  aiLife?: number;
  playerLife?: number;
  shuffle?: boolean;
  playerGoesFirst?: boolean;
  difficulty: MatchState["difficulty"];
  encounterId: string;
}): MatchState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const shuffleDecks = opts.shuffle !== false;
  const pDeck = shuffleDecks ? shuffle(opts.playerDeck, rand) : [...opts.playerDeck];
  const aDeck = shuffleDecks ? shuffle(opts.aiDeck, rand) : [...opts.aiDeck];

  const state: MatchState = {
    seed,
    turn: 1,
    current: opts.playerGoesFirst === false ? "ai" : "player",
    phase: "mulligan",
    winner: null,
    nextIid: 0,
    difficulty: opts.difficulty,
    encounterId: opts.encounterId,
    playerGoesFirst: opts.playerGoesFirst !== false,
    log: ["INITIATING MATCH...", `vs ${opts.aiName}`],
    pending: null,
    player: {
      id: "player",
      name: opts.playerName,
      faction: opts.playerFaction,
      life: opts.playerLife ?? 30,
      energy: 0,
      maxEnergy: 0,
      deck: pDeck,
      hand: [],
      board: [],
      location: null,
      powerUsed: false,
      fatigue: 0,
    },
    ai: {
      id: "ai",
      name: opts.aiName,
      faction: opts.aiFaction,
      life: opts.aiLife ?? 30,
      energy: 0,
      maxEnergy: 0,
      deck: aDeck,
      hand: [],
      board: [],
      location: null,
      powerUsed: false,
      fatigue: 0,
    },
  };

  draw(state, "player", 4);
  draw(state, "ai", state.current === "player" ? 4 : 3);
  if (state.current === "ai") {
    // coin: extra card for second
    draw(state, "player", 1);
  }
  return state;
}

export function confirmMulligan(state: MatchState, replaceIids: string[]): MatchState {
  const next = cloneState(state);
  const side = next.player;
  const keep: CardInst[] = [];
  const back: CardInst[] = [];
  for (const c of side.hand) {
    if (replaceIids.includes(c.iid)) back.push(c);
    else keep.push(c);
  }
  for (const c of back) side.deck.push(c.cardId);
  side.hand = keep;
  draw(next, "player", back.length);
  next.phase = "main";
  log(next, `Mulligan: redrew ${back.length}.`);
  beginTurn(next, next.current);
  return next;
}

function beginTurn(state: MatchState, id: SideId) {
  const side = sideOf(state, id);
  side.maxEnergy = Math.min(10, side.maxEnergy + 1);
  side.energy = side.maxEnergy;
  side.powerUsed = false;
  for (const m of side.board) {
    m.exhausted = false;
    m.ward = false;
    m.attackedThisTurn = 0;
  }
  draw(state, id, 1);
  locationTick(state, id, "start");
  state.current = id;
  state.phase = id === "player" ? "main" : "ai";
  state.pending = null;
  log(state, `${side.name} — energy ${side.energy}.`);
}

function endTurnInternal(state: MatchState) {
  const id = state.current;
  locationTick(state, id, "end");
  const nxt = otherOf(id);
  if (nxt === "player") state.turn += 1;
  beginTurn(state, nxt);
}

export function endTurn(state: MatchState): MatchState {
  if (state.phase !== "main" || state.current !== "player") return state;
  const next = cloneState(state);
  endTurnInternal(next);
  if (next.phase === "ai" && next.winner == null) {
    runAi(next);
  }
  return next;
}

function canPlay(side: SideState, inst: CardInst): boolean {
  const def = resolveCard(inst.cardId);
  if (!def) return false;
  if (side.energy < def.cost) return false;
  if (def.type === "Character" && side.board.length >= 7) return false;
  return true;
}

export function playFromHand(state: MatchState, iid: string): MatchState {
  if (state.phase !== "main" || state.current !== "player") return state;
  const next = cloneState(state);
  const side = next.player;
  const idx = side.hand.findIndex((c) => c.iid === iid);
  if (idx < 0) return state;
  const inst = side.hand[idx]!;
  const def = resolveCard(inst.cardId);
  if (!def || !canPlay(side, inst)) return state;

  if (def.type === "Spell" && spellNeedsTarget(def)) {
    next.pending = {
      kind: "spell",
      cardId: def.id,
      handIndex: idx,
      sourceIid: iid,
      prompt: `Target for ${def.name}`,
    };
    return next;
  }

  resolvePlay(next, "player", idx);
  return next;
}

function spellNeedsTarget(def: CardDef): boolean {
  const t = rulesText(def);
  if (/all enemy|all your|both heroes|each player/i.test(t)) return false;
  return /a target|an enemy|a character|enemy character|friendly|destroy|silence|return|deal \d+ damage(?! to all)/i.test(
    t,
  );
}

function resolvePlay(state: MatchState, id: SideId, handIndex: number, target?: TargetRef) {
  const side = sideOf(state, id);
  const inst = side.hand[handIndex];
  if (!inst) return;
  const def = resolveCard(inst.cardId);
  if (!def) return;
  side.energy -= def.cost;
  side.hand.splice(handIndex, 1);
  log(state, `${side.name} plays ${def.name}.`);

  if (def.type === "Character") {
    const body = makeInst(state, def);
    body.iid = inst.iid;
    side.board.push(body);
    applyBattlecry(state, id, body, def);
    if (target?.minionIid) {
      /* unused */
    }
  } else if (def.type === "Location") {
    side.location = makeInst(state, def, true);
  } else {
    resolveSpell(state, id, def, target);
  }
}

type TargetRef = {
  hero?: SideId;
  minionIid?: string;
  minionOwner?: SideId;
};

function resolveSpell(state: MatchState, id: SideId, def: CardDef, target?: TargetRef) {
  const text = rulesText(def);
  const enemy = otherOf(id);
  const self = sideOf(state, id);
  const foe = sideOf(state, enemy);

  const allDmg = text.match(/deal (\d+)(?: damage)? to all enemy/i);
  if (allDmg) {
    const n = Number(allDmg[1]);
    for (const m of [...foe.board]) damageMinion(state, enemy, m, n);
    if (/heroes|enemy hero/i.test(text)) damageHero(state, enemy, n);
    return;
  }

  const dmg = text.match(/deal (\d+) damage/i);
  if (dmg) {
    const n = Number(dmg[1]);
    if (target?.minionIid && target.minionOwner) {
      const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
      if (m) damageMinion(state, target.minionOwner, m, n);
    } else if (target?.hero) {
      damageHero(state, target.hero, n);
    } else {
      damageHero(state, enemy, n);
    }
  }

  const heal = text.match(/restore (\d+)/i);
  if (heal) healHero(state, id, Number(heal[1]));

  const dr = text.match(/draw (\d+)/i);
  if (dr) draw(state, id, Number(dr[1]));
  else if (/\bdraw a card\b/i.test(text)) draw(state, id, 1);

  if (/silence all enemy/i.test(text)) {
    for (const m of foe.board) silence(m);
  } else if (/silence/i.test(text) && target?.minionIid && target.minionOwner) {
    const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
    if (m) silence(m);
  }

  if (/summon two 2\/1 Raptors/i.test(text)) {
    summonToken(state, id, "neutral_char_008");
    summonToken(state, id, "neutral_char_008");
  } else if (/summon a 2\/1 Raptor/i.test(text)) {
    summonToken(state, id, "neutral_char_008");
  }

  if (/return .* to .* hand/i.test(text) && target?.minionIid && target.minionOwner) {
    const owner = sideOf(state, target.minionOwner);
    const m = findOnBoard(owner, target.minionIid);
    if (m) {
      owner.board = owner.board.filter((c) => c.iid !== m.iid);
      const bounced = resolveCard(m.cardId);
      if (bounced && owner.hand.length < 10) owner.hand.push(makeInst(state, bounced, true));
    }
  }

  if (!dmg && !heal && !dr && !/silence|summon|return/i.test(text)) {
    damageHero(state, enemy, Math.max(1, Math.ceil(def.cost / 2)));
  }

  void self;
}

export function chooseTarget(state: MatchState, target: TargetRef): MatchState {
  if (!state.pending) return state;
  const next = cloneState(state);
  const p = next.pending as PendingTarget;
  next.pending = null;

  if (p.kind === "spell" && p.handIndex != null) {
    resolvePlay(next, "player", p.handIndex, target);
    return next;
  }
  if (p.kind === "attack" && p.sourceIid) {
    resolveAttack(next, "player", p.sourceIid, target);
    return next;
  }
  if (p.kind === "power") {
    usePowerOn(next, "player", target);
    return next;
  }
  return next;
}

export function cancelTarget(state: MatchState): MatchState {
  const next = cloneState(state);
  next.pending = null;
  return next;
}

export function clickAttacker(state: MatchState, iid: string): MatchState {
  if (state.phase !== "main" || state.current !== "player") return state;
  const minion = findOnBoard(state.player, iid);
  if (!minion || minion.exhausted) return state;
  const next = cloneState(state);
  next.pending = {
    kind: "attack",
    sourceIid: iid,
    prompt: `Attack with ${resolveCard(minion.cardId)?.name ?? "asset"}`,
  };
  return next;
}

function resolveAttack(state: MatchState, id: SideId, iid: string, target: TargetRef) {
  const side = sideOf(state, id);
  const attacker = findOnBoard(side, iid);
  if (!attacker || attacker.exhausted) return;
  const legal = legalAttackTargets(state, id, attacker);
  const atk = auraAtk(state, id, attacker);

  if (target.hero && legal.face) {
    damageHero(state, target.hero, atk);
    if (attacker.drain) healHero(state, id, atk);
    attacker.stealth = false;
    attacker.attackedThisTurn += 1;
    attacker.exhausted = !(attacker.enraged && attacker.attackedThisTurn < 2);
    log(state, `${resolveCard(attacker.cardId)?.name} strikes the handler (${atk}).`);
    return;
  }

  if (target.minionIid && target.minionOwner) {
    const defender = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
    if (!defender) return;
    if (legal.minions.every((m) => m.iid !== defender.iid) && legal.minions.length) return;
    const defAtk = auraAtk(state, target.minionOwner, defender);
    damageMinion(state, target.minionOwner, defender, atk, attacker.venom);
    damageMinion(state, id, attacker, defAtk, defender.venom);
    if (attacker.drain) healHero(state, id, atk);
    attacker.stealth = false;
    attacker.attackedThisTurn += 1;
    attacker.exhausted = !(attacker.enraged && attacker.attackedThisTurn < 2);
    log(state, `Trade: ${resolveCard(attacker.cardId)?.name} vs ${resolveCard(defender.cardId)?.name}.`);
  }
}

export function clickHeroPower(state: MatchState): MatchState {
  if (state.phase !== "main" || state.current !== "player") return state;
  const next = cloneState(state);
  const side = next.player;
  if (side.powerUsed || side.energy < 2) return state;
  if (side.faction === "illuminati") {
    next.pending = { kind: "power", prompt: "Pull Strings — 1 damage" };
    return next;
  }
  usePowerOn(next, "player", {});
  return next;
}

function usePowerOn(state: MatchState, id: SideId, target: TargetRef) {
  const side = sideOf(state, id);
  if (side.powerUsed || side.energy < 2) return;
  side.energy -= 2;
  side.powerUsed = true;
  if (side.faction === "illuminati") {
    if (target.minionIid && target.minionOwner) {
      const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
      if (m) damageMinion(state, target.minionOwner, m, 1);
    } else {
      damageHero(state, target.hero ?? otherOf(id), 1);
    }
    log(state, `${side.name} pulls strings.`);
  } else if (side.faction === "templars") {
    if (side.board.length < 7) {
      const inst = makeInst(state, INITIATE, false);
      side.board.push(inst);
      log(state, `${side.name} calls an Initiate.`);
    }
  } else {
    damageHero(state, otherOf(id), 2);
    log(state, `${side.name} lashes with psi.`);
  }
}

function runAi(state: MatchState) {
  const difficulty = state.difficulty;
  let guard = 24;
  while (state.phase === "ai" && state.winner == null && guard-- > 0) {
    const action = pickAi(state, difficulty);
    if (action === "end") break;
    applyAi(state, action);
  }
  if (state.winner == null) endTurnInternal(state);
}

type AiAction =
  | { t: "play"; index: number }
  | { t: "attack"; iid: string; target: TargetRef }
  | { t: "power"; target: TargetRef }
  | "end";

function pickAi(state: MatchState, difficulty: MatchState["difficulty"]): AiAction {
  const side = state.ai;
  const rand = Math.random();
  if (difficulty === "easy" && rand < 0.22) return "end";

  const plays: { index: number; score: number }[] = [];
  side.hand.forEach((c, index) => {
    const def = resolveCard(c.cardId);
    if (!def || side.energy < def.cost) return;
    if (def.type === "Character" && side.board.length >= 7) return;
    let score = def.cost * 2 + (def.attack ?? 0) + (def.health ?? 0);
    if (def.type === "Spell") score += 3;
    plays.push({ index, score });
  });
  plays.sort((a, b) => b.score - a.score);
  if (plays[0] && (difficulty !== "easy" || rand > 0.15)) {
    return { t: "play", index: plays[0].index };
  }

  for (const m of side.board) {
    if (m.exhausted) continue;
    const legal = legalAttackTargets(state, "ai", m);
    const atk = auraAtk(state, "ai", m);
    const killable = legal.minions.find((t) => t.hp <= atk);
    if (killable) return { t: "attack", iid: m.iid, target: { minionIid: killable.iid, minionOwner: "player" } };
    if (legal.face) return { t: "attack", iid: m.iid, target: { hero: "player" } };
    if (legal.minions[0]) {
      return { t: "attack", iid: m.iid, target: { minionIid: legal.minions[0].iid, minionOwner: "player" } };
    }
  }

  if (!side.powerUsed && side.energy >= 2) {
    if (side.faction === "reptilians") return { t: "power", target: {} };
    if (side.faction === "templars" && side.board.length < 7) return { t: "power", target: {} };
    if (side.faction === "illuminati") return { t: "power", target: { hero: "player" } };
  }
  return "end";
}

function applyAi(state: MatchState, action: AiAction) {
  if (action === "end") return;
  if (action.t === "play") resolvePlay(state, "ai", action.index);
  else if (action.t === "attack") resolveAttack(state, "ai", action.iid, action.target);
  else usePowerOn(state, "ai", action.target);
}

export function skipMulligan(state: MatchState): MatchState {
  return confirmMulligan(state, []);
}

export { legalAttackTargets, auraAtk, canPlay };
