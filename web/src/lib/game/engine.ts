import {
  INITIATE,
  keywordsOf,
  resolveCard,
  rulesText,
} from "./catalog";
import { finishPatch, initialTutorialStep } from "./tutorial";
import type {
  CardDef,
  CardInst,
  CampaignMatch,
  CrisisState,
  MatchState,
  PendingTarget,
  SideId,
  SideState,
  TwistState,
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
  const taunt = kws.includes("Taunt");
  return {
    iid: nextIid(state),
    cardId: def.id,
    atk: def.attack ?? 0,
    hp: def.health ?? 1,
    maxHp: def.health ?? 1,
    exhausted: ready ? false : !(charge || rush),
    stealth: kws.includes("Stealth"),
    taunt,
    charge,
    rush,
    venom: kws.includes("Venom"),
    drain: kws.includes("Drain"),
    shielding: kws.includes("Shielding"),
    ward: kws.includes("Ward"),
    silenced: false,
    enraged: kws.includes("Enraged"),
    attackedThisTurn: 0,
    eotAtk: 0,
    eotHp: 0,
    eotTaunt: false,
    innateTaunt: taunt,
    recurUsed: false,
    eotSilence: false,
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

function healMinion(minion: CardInst, amount: number) {
  minion.hp = Math.min(minion.maxHp, minion.hp + amount);
}

function clauseFor(text: string, re: RegExp): string {
  const m = text.match(re);
  return m?.[0] ?? "";
}

function deathClause(text: string): string {
  return (
    clauseFor(text, /Deathrattle[:\s]+[^.]*\.?/i) ||
    clauseFor(text, /when this character (?:dies|is destroyed)[^.]*\.?/i)
  );
}

function playClause(text: string): string {
  const bits = [...text.matchAll(/when played[,:\s]+[^.]*\.?/gi)].map((m) => m[0]);
  return bits.join(" ");
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
  const died = minion.hp <= 0;
  if (!minion.silenced) fireOnDamaged(state, owner, minion);
  if (died) kill(state, owner, minion);
}

function fireOnDamaged(state: MatchState, owner: SideId, minion: CardInst) {
  const def = resolveCard(minion.cardId);
  if (!def) return;
  const text = rulesText(def);
  if (!/when this character is damaged/i.test(text)) return;
  const n = Number(text.match(/deal (\d+) damage to a random enemy character/i)?.[1] ?? 0);
  if (!n) return;
  const foe = sideOf(state, otherOf(owner));
  const vis = foe.board.filter((m) => !m.stealth && m.hp > 0);
  if (!vis.length) return;
  const t = vis[Math.floor(Math.random() * vis.length)]!;
  damageMinion(state, otherOf(owner), t, n);
}

function kill(state: MatchState, owner: SideId, minion: CardInst) {
  const def = resolveCard(minion.cardId);
  const text = def ? rulesText(def) : "";
  if (def && !minion.silenced && /Recur/i.test(text) && !minion.recurUsed) {
    minion.recurUsed = true;
    minion.hp = 1;
    minion.maxHp = Math.max(1, minion.maxHp);
    fireDeathrattle(state, owner, minion, text);
    log(state, `${def.name} Recurs at 1 Health.`);
    return;
  }
  const side = sideOf(state, owner);
  side.board = side.board.filter((c) => c.iid !== minion.iid);
  log(state, `${def?.name ?? "Asset"} is burned.`);
  if (def && !minion.silenced) fireDeathrattle(state, owner, minion, text);
  if (def?.id === "templars_char_001") {
    for (const ally of side.board) {
      const adef = resolveCard(ally.cardId);
      if (adef?.faction === "templars") {
        ally.maxHp = Math.max(1, ally.maxHp - 1);
        ally.hp = Math.max(1, Math.min(ally.hp, ally.maxHp));
      }
    }
  }
}

function fireDeathrattle(state: MatchState, owner: SideId, _minion: CardInst, text: string) {
  const clause = deathClause(text);
  if (!clause) return;
  if (/summon a 2\/1 Raptor/i.test(clause)) {
    summonToken(state, owner, "neutral_char_008", /Charge/i.test(clause));
  }
  const toHero = clause.match(/deal (\d+) damage to the enemy hero/i);
  if (toHero) damageHero(state, otherOf(owner), Number(toHero[1]));
  const drawN = clause.match(/draw (\d+)/i);
  if (drawN) draw(state, owner, Number(drawN[1]));
  else if (/\bdraw a card\b/i.test(clause)) draw(state, owner, 1);
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
  applyTemplarAuraToNew(state, id, inst, def);
  applyEnterModifiers(state, id, inst);
  side.board.push(inst);
  log(state, `${side.name} summons ${def.name}.`);
}

function applyEnterModifiers(state: MatchState, owner: SideId, inst: CardInst) {
  const bonus = state.twist?.enemyHealthBonus ?? 0;
  if (bonus && owner === "ai") {
    inst.hp += bonus;
    inst.maxHp += bonus;
  }
}

function applyHallowedGround(state: MatchState, owner: SideId, inst: CardInst) {
  const bonus = state.twist?.firstCharacterHealthBonus ?? 0;
  if (!bonus) return;
  const side = sideOf(state, owner);
  if (side.hallowedUsed) return;
  side.hallowedUsed = true;
  inst.hp += bonus;
  inst.maxHp += bonus;
  const name = resolveCard(inst.cardId)?.name ?? "body";
  log(state, `Hallowed Ground: ${name} +${bonus} Health.`);
}

function applyStaticAir(state: MatchState, def: { name: string }): boolean {
  const n = state.twist?.negateEveryN ?? 0;
  if (!n || !state.twist) return false;
  state.twist.spellsCast += 1;
  if (state.twist.spellsCast % n !== 0) return false;
  log(state, `Static Air: ${def.name} fizzles.`);
  return true;
}

function applyTemplarAuraToNew(state: MatchState, id: SideId, inst: CardInst, def: CardDef) {
  if (def.faction !== "templars" || def.id === "templars_char_001") return;
  const side = sideOf(state, id);
  const commander = side.board.some((m) => m.cardId === "templars_char_001" && !m.silenced);
  if (commander) {
    inst.hp += 1;
    inst.maxHp += 1;
  }
}

function applyBattlecry(state: MatchState, id: SideId, inst: CardInst, def: CardDef, target?: TargetRef) {
  if (inst.silenced) return;
  const text = rulesText(def);
  const clause = playClause(text);
  const enemy = otherOf(id);
  const self = sideOf(state, id);
  const foe = sideOf(state, enemy);

  const plus = clause.match(/\+(\d+)\/\+(\d+)/);
  if (plus) {
    inst.atk += Number(plus[1]);
    inst.hp += Number(plus[2]);
    inst.maxHp += Number(plus[2]);
  }

  const dmg = clause.match(/deal (\d+) damage/i);
  if (dmg) {
    const n = Number(dmg[1]);
    if (/all enemy/i.test(clause)) {
      for (const m of [...foe.board]) damageMinion(state, enemy, m, n);
      if (/hero|all enemies/i.test(clause)) damageHero(state, enemy, n);
    } else if (target?.minionIid && target.minionOwner) {
      const t = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
      if (t) damageMinion(state, target.minionOwner, t, n);
    } else if (foe.board.filter((m) => !m.stealth).length) {
      damageMinion(state, enemy, foe.board.find((m) => !m.stealth)!, n);
    } else {
      damageHero(state, enemy, n);
    }
  }

  if (/discard/i.test(clause) && foe.hand.length) {
    const i = Math.floor(foe.hand.length * 0.37) % foe.hand.length;
    const gone = foe.hand.splice(i, 1)[0];
    const gdef = gone ? resolveCard(gone.cardId) : undefined;
    log(state, `${foe.name} discards ${gdef?.name ?? "a file"}.`);
  }

  const drawN = clause.match(/draw (\d+)/i);
  if (drawN) draw(state, id, Number(drawN[1]));
  else if (/\bdraw a card\b/i.test(clause)) draw(state, id, 1);

  if (/silence/i.test(clause)) {
    const t =
      target?.minionIid && target.minionOwner
        ? findOnBoard(sideOf(state, target.minionOwner), target.minionIid)
        : foe.board.find((m) => !m.stealth);
    if (t) silence(t);
  }

  const restore = clause.match(/restore (\d+)/i);
  if (restore) healHero(state, id, Number(restore[1]));

  if (/return an enemy character/i.test(clause) || /return an enemy character/i.test(text)) {
    const cap = Number(text.match(/(\d+) or less Attack/i)?.[1] ?? 99);
    const bounce =
      target?.minionIid && target.minionOwner
        ? findOnBoard(sideOf(state, target.minionOwner), target.minionIid)
        : foe.board.find((m) => m.atk <= cap && !m.stealth);
    if (bounce && bounce.atk <= cap) bounceToHand(state, target?.minionOwner ?? enemy, bounce);
  }

  if (/take control of an enemy character/i.test(text) && foe.board.length) {
    const cap = Number(text.match(/(\d+) or less Attack/i)?.[1] ?? 2);
    const steal = foe.board.find((m) => m.atk <= cap && !m.stealth);
    if (steal && self.board.length < 7) {
      foe.board = foe.board.filter((c) => c.iid !== steal.iid);
      steal.exhausted = true;
      self.board.push(steal);
      log(state, `${self.name} seizes ${resolveCard(steal.cardId)?.name}.`);
    }
  }

  if (def.id === "templars_char_001" || /other templar characters you control gain \+1 health/i.test(text)) {
    for (const ally of self.board) {
      if (ally.iid === inst.iid) continue;
      const adef = resolveCard(ally.cardId);
      if (adef?.faction === "templars") {
        ally.hp += 1;
        ally.maxHp += 1;
      }
    }
  }

  applyTemplarAuraToNew(state, id, inst, def);
  void self;
}

function discardFromHand(side: SideState, n: number, state: MatchState) {
  for (let i = 0; i < n && side.hand.length; i++) {
    const idx = Math.floor(side.hand.length * 0.37) % side.hand.length;
    const gone = side.hand.splice(idx, 1)[0];
    const gdef = gone ? resolveCard(gone.cardId) : undefined;
    log(state, `${side.name} discards ${gdef?.name ?? "a file"}.`);
  }
}

function bounceToHand(state: MatchState, owner: SideId, minion: CardInst) {
  const side = sideOf(state, owner);
  side.board = side.board.filter((c) => c.iid !== minion.iid);
  const def = resolveCard(minion.cardId);
  if (def && side.hand.length < 10) side.hand.push(makeInst(state, def, true));
  log(state, `${def?.name ?? "Asset"} is pulled back.`);
}

function silence(minion: CardInst, untilEot = false) {
  if (untilEot && !minion.silenced) minion.eotSilence = true;
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

function unsilence(minion: CardInst) {
  minion.silenced = false;
  minion.eotSilence = false;
  const def = resolveCard(minion.cardId);
  if (!def) return;
  const kws = keywordsOf(def);
  minion.taunt = kws.includes("Taunt") || minion.innateTaunt;
  minion.stealth = kws.includes("Stealth") && minion.attackedThisTurn === 0;
  minion.charge = kws.includes("Charge");
  minion.rush = kws.includes("Rush");
  minion.venom = kws.includes("Venom");
  minion.drain = kws.includes("Drain");
  minion.shielding = kws.includes("Shielding");
  minion.ward = kws.includes("Ward");
  minion.enraged = kws.includes("Enraged");
}

function applyEotHp(minion: CardInst, n: number) {
  minion.hp += n;
  minion.maxHp += n;
  minion.eotHp = (minion.eotHp ?? 0) + n;
}

function applyEotAtk(minion: CardInst, n: number) {
  minion.atk = Math.max(0, minion.atk + n);
  minion.eotAtk = (minion.eotAtk ?? 0) + n;
}

function grantEotTaunt(minion: CardInst) {
  if (!minion.taunt) {
    minion.taunt = true;
    minion.eotTaunt = true;
  }
}

function clearEot(state: MatchState, id: SideId) {
  const side = sideOf(state, id);
  for (const m of side.board) {
    if (m.eotAtk) {
      m.atk = Math.max(0, m.atk - m.eotAtk);
      m.eotAtk = 0;
    }
    if (m.eotHp) {
      m.maxHp = Math.max(1, m.maxHp - m.eotHp);
      m.hp = Math.max(1, Math.min(m.hp, m.maxHp));
      m.eotHp = 0;
    }
    if (m.eotTaunt) {
      m.taunt = m.innateTaunt && !m.silenced;
      m.eotTaunt = false;
    }
    if (m.eotSilence) unsilence(m);
    m.ward = false;
  }
}

function boardTick(state: MatchState, id: SideId, when: "start" | "end") {
  const side = sideOf(state, id);
  const enemy = otherOf(id);
  const foe = sideOf(state, enemy);

  const loc = side.location;
  if (loc) {
    const def = resolveCard(loc.cardId);
    const text = def ? rulesText(def) : "";
    if (when === "start") {
      if (/start of your turn/i.test(text) && /heal 1|restore 1/i.test(text)) {
        for (const m of side.board) healMinion(m, 1);
        if (/hero/i.test(text)) healHero(state, id, 1);
      }
      if (/start of your turn/i.test(text) && /deal 1 damage to the enemy hero/i.test(text)) {
        damageHero(state, enemy, 1);
      }
      if (/start of your turn/i.test(text) && /draw a card/i.test(text)) {
        if (/if you have fewer cards than your opponent/i.test(text)) {
          if (side.hand.length < foe.hand.length) draw(state, id, 1);
        } else {
          draw(state, id, 1);
        }
      }
    }
    if (when === "end") {
      if (/end of your turn/i.test(text) && /draw a card/i.test(text)) draw(state, id, 1);
      if (/summon a 2\/1 Raptor/i.test(text) && /end of your turn/i.test(text)) {
        summonToken(state, id, "neutral_char_008", /Charge/i.test(text));
      }
    }
  }

  for (const m of [...side.board]) {
    if (m.silenced) continue;
    const def = resolveCard(m.cardId);
    if (!def) continue;
    const text = rulesText(def);
    if (when === "end" && /at the end of your turn/i.test(text)) {
      const healAll = text.match(/restore (\d+) Health to all friendly/i);
      if (healAll) {
        const n = Number(healAll[1]);
        for (const ally of side.board) healMinion(ally, n);
      }
      if (/summon a 2\/1 Raptor/i.test(text)) {
        summonToken(state, id, "neutral_char_008", /Charge/i.test(text));
      }
    }
  }
}

function auraAtk(state: MatchState, owner: SideId, minion: CardInst): number {
  const side = sideOf(state, owner);
  let bonus = 0;
  if (side.location) {
    const def = resolveCard(side.location.cardId);
    const text = def ? rulesText(def) : "";
    if (/\bgain \+1 Attack\b/i.test(text) && !/when /i.test(text)) bonus += 1;
  }
  return minion.atk + bonus;
}

function legalAttackTargets(state: MatchState, attackerOwner: SideId, attacker: CardInst) {
  const enemy = sideOf(state, otherOf(attackerOwner));
  const taunts = enemy.board.filter((m) => m.taunt && !m.stealth);
  const vis = enemy.board.filter((m) => !m.stealth);
  if (taunts.length) return { minions: taunts, face: false };
  const rushLocked = attacker.rush && !attacker.charge && attacker.attackedThisTurn === 0;
  return { minions: vis, face: !rushLocked };
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
  skipMulligan?: boolean;
  campaign?: CampaignMatch | null;
  crisis?: Omit<CrisisState, "turnsCompleted"> | null;
  twist?: TwistState | null;
}): MatchState {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const shuffleDecks = opts.shuffle !== false;
  const pDeck = shuffleDecks ? shuffle(opts.playerDeck, rand) : [...opts.playerDeck];
  const aDeck = shuffleDecks ? shuffle(opts.aiDeck, rand) : [...opts.aiDeck];
  const campaign = opts.campaign ?? null;
  const crisis: CrisisState | null = opts.crisis
    ? { ...opts.crisis, turnsCompleted: 0 }
    : null;
  const twist = opts.twist ?? null;

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
    tutorialStep: campaign?.steps?.[0]?.id ?? initialTutorialStep(opts.encounterId),
    campaign,
    crisis,
    twist,
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
      hallowedUsed: false,
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
      hallowedUsed: false,
    },
  };

  if (campaign?.coach === "silent") log(state, "Radio dead. Survive.");
  if (twist) log(state, `TWIST: ${twist.label} — ${twist.description}`);
  draw(state, "player", 4);
  draw(state, "ai", state.current === "player" ? 4 : 3);
  if (state.current === "ai") {
    draw(state, "player", 1);
  }
  if (opts.skipMulligan) {
    state.phase = "main";
    beginTurn(state, state.current);
    return state;
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
  if (back.length) side.deck = shuffle(side.deck, mulberry32(next.seed ^ (back.length * 9973)));
  side.hand = keep;
  draw(next, "player", back.length);
  next.phase = "main";
  log(next, `Mulligan: redrew ${back.length}.`);
  beginTurn(next, next.current);
  return finishPatch(state, next);
}

function beginTurn(state: MatchState, id: SideId) {
  const side = sideOf(state, id);
  const opening = side.maxEnergy === 0;
  side.maxEnergy = Math.min(10, side.maxEnergy + 1);
  side.energy = side.maxEnergy;
  side.powerUsed = false;
  side.hallowedUsed = false;
  for (const m of side.board) {
    m.exhausted = false;
    m.attackedThisTurn = 0;
  }
  const firstPlayer = state.playerGoesFirst ? "player" : "ai";
  const skipDraw = opening && id === firstPlayer;
  if (!skipDraw) draw(state, id, 1);
  boardTick(state, id, "start");
  state.current = id;
  state.phase = id === "player" ? "main" : "ai";
  state.pending = null;
  log(state, `${side.name} — energy ${side.energy}.`);
}

function endTurnInternal(state: MatchState) {
  const id = state.current;
  clearEot(state, id);
  boardTick(state, id, "end");
  if (
    state.crisis?.win === "survive_turns" &&
    state.winner == null &&
    id === "player"
  ) {
    state.crisis.turnsCompleted += 1;
    if (state.crisis.turnsCompleted >= state.crisis.turnsRequired) {
      state.phase = "over";
      state.winner = "player";
      log(state, `${state.crisis.label} — you lasted ${state.crisis.turnsCompleted} turns.`);
      return;
    }
  }
  if (state.winner != null) return;
  const nxt = otherOf(id);
  if (nxt === "player") state.turn += 1;
  beginTurn(state, nxt);
}

export function endTurn(state: MatchState): MatchState {
  if (state.phase !== "main" || state.current !== "player") return state;
  const next = cloneState(state);
  endTurnInternal(next);
  return finishPatch(state, next);
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
  return finishPatch(state, next);
}

export function spellNeedsTarget(def: CardDef): boolean {
  const t = rulesText(def);
  if (/all enemy|all your|both heroes|each player/i.test(t)) return false;
  if (/give all your/i.test(t)) return false;
  return /a target|an enemy|a character|enemy character|friendly|destroy|silence|return|deal \d+ damage(?! to all)|your hero or a character/i.test(
    t,
  );
}

export function spellAllowsHero(def: CardDef): boolean {
  const t = rulesText(def);
  if (/your hero or a character/i.test(t)) return true;
  if (/to the enemy hero/i.test(t)) return true;
  if (/any target/i.test(t)) return true;
  if (/target character|an enemy character|a target character/i.test(t) && !/hero/i.test(t)) return false;
  if (/deal \d+ damage/i.test(t) && /character/i.test(t) && !/hero/i.test(t)) return false;
  if (/give an enemy character/i.test(t)) return false;
  return /hero/i.test(t) || /deal \d+ damage/i.test(t);
}

export function spellAllowsEnemyMinion(def: CardDef): boolean {
  const t = rulesText(def);
  if (/all your|restore/i.test(t) && !/deal/i.test(t) && !/enemy/i.test(t)) return false;
  if (/your hero or a character/i.test(t)) return true;
  return /a target|an enemy|a character|enemy character|destroy|silence|return|deal \d+ damage|give an enemy/i.test(t);
}

export function spellAllowsFriendlyMinion(def: CardDef): boolean {
  const t = rulesText(def);
  return /your hero or a character|friendly|restore/i.test(t);
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
    applyEnterModifiers(state, id, body);
    applyHallowedGround(state, id, body);
    side.board.push(body);
    applyBattlecry(state, id, body, def, target);
  } else if (def.type === "Location") {
    side.location = makeInst(state, def, true);
  } else {
    if (!applyStaticAir(state, def)) resolveSpell(state, id, def, target);
  }
}

export type TargetRef = {
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

  const eotHp = text.match(/give all your characters \+(\d+) Health until end of turn/i);
  if (eotHp) {
    const n = Number(eotHp[1]);
    for (const m of self.board) applyEotHp(m, n);
  }

  if (/gain Taunt until end of turn/i.test(text)) {
    for (const m of self.board) grantEotTaunt(m);
  }

  const eotAtk = text.match(/give an enemy character -(\d+) Attack until end of turn/i);
  if (eotAtk && target?.minionIid && target.minionOwner) {
    const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
    if (m) applyEotAtk(m, -Number(eotAtk[1]));
  }

  const charDmg = text.match(/deal (\d+) damage to (?:a target character|an enemy character)/i);
  if (charDmg) {
    const n = Number(charDmg[1]);
    if (target?.minionIid && target.minionOwner) {
      const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
      if (m) {
        damageMinion(state, target.minionOwner, m, n);
        if (/if it dies, draw/i.test(text) && !findOnBoard(sideOf(state, target.minionOwner), target.minionIid)) {
          draw(state, id, 1);
        }
      }
    }
  } else {
    const dmg = text.match(/deal (\d+) damage/i);
    if (dmg) {
      const n = Number(dmg[1]);
      if (target?.minionIid && target.minionOwner) {
        const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
        if (m) damageMinion(state, target.minionOwner, m, n);
      } else if (target?.hero && spellAllowsHero(def)) {
        damageHero(state, target.hero, n);
      } else if (spellAllowsHero(def)) {
        damageHero(state, enemy, n);
      }
    }
  }

  const heal = text.match(/restore (\d+)/i);
  if (heal) {
    const n = Number(heal[1]);
    if (target?.minionIid && target.minionOwner) {
      const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
      if (m) healMinion(m, n);
    } else {
      healHero(state, id, n);
    }
  }

  if (!/if it dies, draw/i.test(text)) {
    const dr = text.match(/draw (\d+)/i);
    if (dr) draw(state, id, Number(dr[1]));
    else if (/\bdraw a card\b/i.test(text)) draw(state, id, 1);
  }

  if (/silence all enemy/i.test(text)) {
    const untilEot = /until end of turn/i.test(text);
    for (const m of foe.board) silence(m, untilEot);
  } else if (/silence/i.test(text) && target?.minionIid && target.minionOwner) {
    const m = findOnBoard(sideOf(state, target.minionOwner), target.minionIid);
    if (m) silence(m, /until end of turn/i.test(text));
  }

  const oppDisc = text.match(/opponent discards (\d+)/i);
  if (oppDisc) discardFromHand(foe, Number(oppDisc[1]), state);
  const eachDisc = text.match(/each player discards (\d+)/i);
  if (eachDisc) {
    const n = Number(eachDisc[1]);
    discardFromHand(self, n, state);
    discardFromHand(foe, n, state);
  }

  if (/summon two 2\/1 Raptors/i.test(text)) {
    summonToken(state, id, "neutral_char_008");
    summonToken(state, id, "neutral_char_008");
  } else if (/summon a 2\/1 Raptor/i.test(text) && !/end of your turn/i.test(text)) {
    summonToken(state, id, "neutral_char_008");
  }

  if (/return .* to .* hand/i.test(text) && target?.minionIid && target.minionOwner) {
    const owner = sideOf(state, target.minionOwner);
    const m = findOnBoard(owner, target.minionIid);
    if (m) bounceToHand(state, target.minionOwner, m);
  }
}

export function chooseTarget(state: MatchState, target: TargetRef): MatchState {
  if (!state.pending) return state;
  const next = cloneState(state);
  const p = next.pending as PendingTarget;
  next.pending = null;

  if (p.kind === "spell" && p.handIndex != null) {
    const def = p.cardId ? resolveCard(p.cardId) : undefined;
    if (def && target.hero && !spellAllowsHero(def)) {
      next.pending = p;
      log(next, `${def.name} needs a character.`);
      return next;
    }
    resolvePlay(next, "player", p.handIndex, target);
    return finishPatch(state, next);
  }
  if (p.kind === "attack" && p.sourceIid) {
    resolveAttack(next, "player", p.sourceIid, target);
    return finishPatch(state, next);
  }
  if (p.kind === "power") {
    usePowerOn(next, "player", target);
    return finishPatch(state, next);
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
  if (!minion) return state;
  if (minion.exhausted) {
    const next = cloneState(state);
    log(next, `${resolveCard(minion.cardId)?.name ?? "It"} cannot attack yet — exhausted this turn.`);
    return next;
  }
  const next = cloneState(state);
  next.pending = {
    kind: "attack",
    sourceIid: iid,
    prompt: `Attack with ${resolveCard(minion.cardId)?.name ?? "asset"}`,
  };
  return next;
}

function fireOnAttack(state: MatchState, id: SideId, attacker: CardInst, target: TargetRef) {
  if (attacker.silenced) return;
  const def = resolveCard(attacker.cardId);
  const text = def ? rulesText(def) : "";
  const side = sideOf(state, id);
  const foe = sideOf(state, otherOf(id));

  if (/when this character attacks/i.test(text)) {
    const gain = text.match(/gains? \+(\d+) Attack/i);
    if (gain) attacker.atk += Number(gain[1]);
    const others = text.match(/give your other characters \+(\d+) Attack this turn/i);
    if (others) {
      const n = Number(others[1]);
      for (const m of side.board) {
        if (m.iid === attacker.iid) continue;
        applyEotAtk(m, n);
      }
    }
    if (target.hero && /attacks the enemy hero/i.test(text)) {
      const extra = text.match(/deal (\d+) damage and restore (\d+)/i);
      if (extra) {
        damageHero(state, target.hero, Number(extra[1]));
        healHero(state, id, Number(extra[2]));
      }
      if (/steal 1/i.test(text) && foe.energy > 0) {
        foe.energy -= 1;
        side.energy += 1;
      }
    }
  }

  if (side.location) {
    const ldef = resolveCard(side.location.cardId);
    const ltext = ldef ? rulesText(ldef) : "";
    if (/when this character attacks, draw a card/i.test(ltext)) {
      if (!( /Reptilian/i.test(ltext) && def && def.faction !== "reptilians")) draw(state, id, 1);
    }
    const onHit = ltext.match(/when one of your characters attacks, give it \+(\d+) Attack/i);
    if (onHit) attacker.atk += Number(onHit[1]);
  }
}

function resolveAttack(state: MatchState, id: SideId, iid: string, target: TargetRef) {
  const side = sideOf(state, id);
  const attacker = findOnBoard(side, iid);
  if (!attacker || attacker.exhausted) return;
  const legal = legalAttackTargets(state, id, attacker);

  if (target.hero && !legal.face) {
    log(state, "Taunt is in the way.");
    return;
  }

  fireOnAttack(state, id, attacker, target);
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
    if (legal.minions.every((m) => m.iid !== defender.iid) && legal.minions.length) {
      log(state, "Taunt is in the way.");
      return;
    }
    const defAtk = auraAtk(state, target.minionOwner, defender);
    const defenderDied = defender.hp <= atk || attacker.venom;
    damageMinion(state, target.minionOwner, defender, atk, attacker.venom);
    damageMinion(state, id, attacker, defAtk, defender.venom);
    if (attacker.drain) healHero(state, id, atk);
    const killerText = resolveCard(attacker.cardId);
    if (defenderDied && killerText && /when this character destroys an enemy character/i.test(rulesText(killerText))) {
      const still = findOnBoard(side, attacker.iid);
      if (still) {
        still.atk += 1;
        still.hp += 1;
        still.maxHp += 1;
      }
    }
    if (findOnBoard(side, attacker.iid)) {
      attacker.stealth = false;
      attacker.attackedThisTurn += 1;
      attacker.exhausted = !(attacker.enraged && attacker.attackedThisTurn < 2);
    }
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
  return finishPatch(state, next);
}

export function attackWith(state: MatchState, iid: string, target: TargetRef): MatchState {
  if (state.phase !== "main" || state.current !== "player") return state;
  const minion = findOnBoard(state.player, iid);
  if (!minion || minion.exhausted) return state;
  const next = cloneState(state);
  next.pending = null;
  resolveAttack(next, "player", iid, target);
  return finishPatch(state, next);
}

export function playCardOn(state: MatchState, iid: string, target?: TargetRef): MatchState {
  if (state.phase !== "main" || state.current !== "player") return state;
  let next = playFromHand(state, iid);
  if (next.pending && target && (target.hero || target.minionIid)) {
    next = chooseTarget(next, target);
  }
  return next;
}

export type AiAction =
  | { t: "play"; index: number }
  | { t: "attack"; iid: string; target: TargetRef }
  | { t: "power"; target: TargetRef }
  | "end";

export function planAi(state: MatchState): AiAction {
  return pickAi(state, state.difficulty);
}

export function applyAiAction(state: MatchState, action: AiAction): MatchState {
  const next = cloneState(state);
  if (action === "end") {
    if (next.winner == null) endTurnInternal(next);
    return finishPatch(state, next);
  }
  applyAi(next, action);
  return finishPatch(state, next);
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
      applyTemplarAuraToNew(state, id, inst, INITIATE);
      applyEnterModifiers(state, id, inst);
      side.board.push(inst);
      log(state, `${side.name} calls an Initiate.`);
    }
  } else {
    damageHero(state, otherOf(id), 2);
    log(state, `${side.name} lashes with psi.`);
  }
}

function pickAi(state: MatchState, difficulty: MatchState["difficulty"]): AiAction {
  const side = state.ai;
  const rand = Math.random();
  const teaching = (state.encounterId === "tutorial" || Boolean(state.campaign?.teach)) && state.turn <= 3;
  if (difficulty === "easy" && !teaching && rand < 0.22) return "end";

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
  if (plays[0] && (teaching || difficulty !== "easy" || rand > 0.15)) {
    return { t: "play", index: plays[0].index };
  }

  for (const m of side.board) {
    if (m.exhausted) continue;
    const legal = legalAttackTargets(state, "ai", m);
    const atk = auraAtk(state, "ai", m);
    const killable = legal.minions.find((t) => t.hp <= atk);
    if (killable) return { t: "attack", iid: m.iid, target: { minionIid: killable.iid, minionOwner: "player" } };
    if (legal.face && difficulty === "hard" && state.player.life <= atk + 1) {
      return { t: "attack", iid: m.iid, target: { hero: "player" } };
    }
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

function pickAiSpellTarget(state: MatchState, def: CardDef): TargetRef | undefined {
  if (spellAllowsEnemyMinion(def) && state.player.board.length) {
    const vis = state.player.board.filter((m) => !m.stealth);
    const killable = vis.find((m) => m.hp <= 3);
    const t = killable ?? vis[0];
    if (t) return { minionIid: t.iid, minionOwner: "player" };
  }
  if (spellAllowsHero(def)) return { hero: "player" };
  if (spellAllowsFriendlyMinion(def) && state.ai.board.length) {
    const hurt = state.ai.board.find((m) => m.hp < m.maxHp) ?? state.ai.board[0];
    if (hurt) return { minionIid: hurt.iid, minionOwner: "ai" };
  }
  return undefined;
}

function applyAi(state: MatchState, action: AiAction) {
  if (action === "end") return;
  if (action.t === "play") {
    const inst = state.ai.hand[action.index];
    const def = inst ? resolveCard(inst.cardId) : undefined;
    const target =
      def && def.type === "Spell" && spellNeedsTarget(def) ? pickAiSpellTarget(state, def) : undefined;
    resolvePlay(state, "ai", action.index, target);
  } else if (action.t === "attack") resolveAttack(state, "ai", action.iid, action.target);
  else usePowerOn(state, "ai", action.target);
}

export function skipMulligan(state: MatchState): MatchState {
  return confirmMulligan(state, []);
}

export { legalAttackTargets, auraAtk, canPlay };
