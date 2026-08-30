import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { CardBack, CardFace, MiniMinion } from "@/components/cards/CardFace";
import {
  energyCrystal,
  nameplateArt,
  portraitFor,
  powerArt,
  POWER_META,
  resolveCard,
  rulesText,
} from "@/lib/game/catalog";
import {
  applyAiAction,
  attackWith,
  auraAtk,
  cancelTarget,
  chooseTarget,
  clickAttacker,
  clickHeroPower,
  endTurn,
  legalAttackTargets,
  planAi,
  playCardOn,
  spellAllowsEnemyMinion,
  spellAllowsFriendlyMinion,
  spellAllowsHero,
  type TargetRef,
} from "@/lib/game/engine";
import { coachFor } from "@/lib/game/tutorial";
import { faceEl, flashEl, floatText, flyFromHand, lunge, sleep, unitEl } from "@/lib/game/fx";
import { FACTION_META, type CardDef, type CardInst, type MatchState, type SideId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function packSlots(units: CardInst[], n = 7) {
  const slots: (CardInst | null)[] = Array.from({ length: n }, () => null);
  const start = Math.max(0, Math.floor((n - units.length) / 2));
  units.forEach((u, i) => {
    if (start + i < n) slots[start + i] = u;
  });
  return slots;
}

type DragKind = "hand" | "attacker" | "power";

type DropHint = {
  board: boolean;
  face: boolean;
  hero: boolean;
  location: boolean;
  legalIids: string[];
};

const EMPTY_HINT: DropHint = { board: false, face: false, hero: false, location: false, legalIids: [] };

function hintForHand(def: CardDef, match: MatchState): DropHint {
  const t = rulesText(def);
  if (def.type === "Location") return { ...EMPTY_HINT, board: true, location: true };
  if (def.type === "Character") return { ...EMPTY_HINT, board: true };
  const enemyIids = spellAllowsEnemyMinion(def)
    ? match.ai.board.filter((m) => !m.stealth).map((m) => m.iid)
    : [];
  const allyIids = spellAllowsFriendlyMinion(def) ? match.player.board.map((m) => m.iid) : [];
  const ownHero = /your hero/i.test(t);
  const enemyHero = spellAllowsHero(def) && !ownHero;
  return {
    ...EMPTY_HINT,
    face: enemyHero,
    hero: ownHero,
    legalIids: [...enemyIids, ...allyIids],
    board: def.type !== "Spell",
  };
}

function hintForAttack(match: MatchState, iid: string): DropHint {
  const m = match.player.board.find((c) => c.iid === iid);
  if (!m) return EMPTY_HINT;
  const legal = legalAttackTargets(match, "player", m);
  return {
    ...EMPTY_HINT,
    face: legal.face,
    legalIids: legal.minions.map((x) => x.iid),
  };
}

function fanVars(i: number, n: number, lifted: boolean): CSSProperties {
  const mid = (n - 1) / 2;
  const d = i - mid;
  return {
    ["--fan-rot" as string]: `${d * (n > 6 ? 4.2 : 5.5)}deg`,
    ["--fan-y" as string]: `${Math.abs(d) * (n > 6 ? 7 : 9)}px`,
    zIndex: lifted ? 40 : 10 + i,
  };
}

export function TableMatch({
  match,
  inspectId,
  onChange,
  onInspect,
}: {
  match: MatchState;
  inspectId: string | null;
  onChange: (next: MatchState) => void;
  onInspect: (id: string | null) => void;
}) {
  const matchRef = useRef(match);
  matchRef.current = match;
  const busy = useRef(false);
  const dragConsumed = useRef(false);
  const seenIids = useRef<Set<string>>(new Set());
  const [clock, setClock] = useState(75);
  const [lifted, setLifted] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; cardId?: string; kind: DragKind } | null>(null);
  const [hint, setHint] = useState<DropHint>(EMPTY_HINT);
  const drag = useRef<{
    tracking: boolean;
    active: boolean;
    kind: DragKind | null;
    iid: string;
    startX: number;
    startY: number;
  }>({ tracking: false, active: false, kind: null, iid: "", startX: 0, startY: 0 });

  const patch = (next: MatchState) => {
    matchRef.current = next;
    onChange(next);
  };

  useEffect(() => {
    for (const m of [...match.player.board, ...match.ai.board]) seenIids.current.add(m.iid);
  }, [match]);

  useEffect(() => {
    if (match.phase !== "main" || match.current !== "player") return;
    setClock(75);
    let remaining = 75;
    const id = window.setInterval(() => {
      remaining -= 1;
      setClock(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        if (!busy.current) void runEndTurn();
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.turn, match.phase, match.current]);

  async function runEndTurn() {
    if (busy.current) return;
    const cur = matchRef.current;
    if (cur.phase !== "main") return;
    busy.current = true;
    let next = endTurn(cur);
    patch(next);
    await runAiLoop();
    busy.current = false;
  }

  async function runAiLoop() {
    let cur = matchRef.current;
    let guard = 24;
    while (cur.phase === "ai" && !cur.winner && guard-- > 0) {
      const action = planAi(cur);
      if (action === "end") {
        cur = applyAiAction(cur, "end");
        patch(cur);
        break;
      }
      if (action.t === "play") {
        const inst = cur.ai.hand[action.index];
        await flyFromHand("opp-hand", "ai-board");
        if (inst) floatText(document.getElementById("ai-board"), resolveCard(inst.cardId)?.name ?? "", "good");
      } else if (action.t === "attack") {
        const atk = unitEl(action.iid);
        const tgt = action.target.hero ? faceEl("player") : unitEl(action.target.minionIid);
        const attacker = cur.ai.board.find((m) => m.iid === action.iid);
        const dmg = attacker ? auraAtk(cur, "ai", attacker) : 0;
        await lunge(atk, tgt, dmg);
      } else if (action.t === "power") {
        const btn = document.getElementById("ai-power");
        btn?.classList.add("pulse");
        setTimeout(() => btn?.classList.remove("pulse"), 500);
        flashEl(faceEl("player"), "fx-flash-red");
        await sleep(280);
      }
      cur = applyAiAction(cur, action);
      patch(cur);
      await sleep(180);
    }
  }

  async function playHand(iid: string, target?: TargetRef) {
    if (busy.current || matchRef.current.phase !== "main") return;
    const next = playCardOn(matchRef.current, iid, target);
    if (next === matchRef.current) return;
    // Still pending = needs a legal target (or the drop was illegal, e.g. Smite on face).
    if (next.pending) {
      patch(next);
      return;
    }
    busy.current = true;
    const src = document.querySelector(`[data-hand-iid="${CSS.escape(iid)}"]`);
    await flyFromHand(src, document.getElementById("player-board"));
    patch(next);
    busy.current = false;
  }

  async function doAttack(iid: string, target: TargetRef) {
    if (busy.current || matchRef.current.phase !== "main") return;
    const attacker = matchRef.current.player.board.find((m) => m.iid === iid);
    if (!attacker) return;
    if (attacker.exhausted) {
      patch(clickAttacker(matchRef.current, iid));
      return;
    }
    const legal = legalAttackTargets(matchRef.current, "player", attacker);
    const blockedFace = Boolean(target.hero && !legal.face);
    const blockedBody =
      Boolean(target.minionIid) &&
      legal.minions.length > 0 &&
      legal.minions.every((m) => m.iid !== target.minionIid);
    if (blockedFace || blockedBody) {
      patch(attackWith(matchRef.current, iid, target));
      return;
    }
    const dmg = auraAtk(matchRef.current, "player", attacker);
    let taken = 0;
    let kill = false;
    if (target.minionIid) {
      const def = matchRef.current.ai.board.find((m) => m.iid === target.minionIid);
      if (def) {
        taken = auraAtk(matchRef.current, "ai", def);
        kill = def.hp <= dmg;
      }
    }
    busy.current = true;
    await lunge(unitEl(iid), target.hero ? faceEl("ai") : unitEl(target.minionIid), dmg, taken, kill);
    patch(attackWith(matchRef.current, iid, target));
    busy.current = false;
  }

  function firePower(target?: TargetRef) {
    const next = clickHeroPower(matchRef.current);
    const btn = document.getElementById("player-power");
    btn?.classList.add("pulse");
    setTimeout(() => btn?.classList.remove("pulse"), 500);
    if (next.pending && target) {
      patch(chooseTarget(next, target));
      return;
    }
    patch(next);
  }

  function onHandDown(e: ReactPointerEvent, iid: string) {
    if (e.button !== 0 || match.phase !== "main") return;
    e.preventDefault();
    drag.current = { tracking: true, active: false, kind: "hand", iid, startX: e.clientX, startY: e.clientY };
  }

  function onMinionDown(e: ReactPointerEvent, iid: string) {
    if (e.button !== 0 || match.phase !== "main") return;
    const m = match.player.board.find((c) => c.iid === iid);
    if (!m || m.exhausted || m.atk <= 0) return;
    e.preventDefault();
    drag.current = { tracking: true, active: false, kind: "attacker", iid, startX: e.clientX, startY: e.clientY };
  }

  function onPowerDown(e: ReactPointerEvent) {
    if (e.button !== 0 || match.phase !== "main") return;
    if (match.player.powerUsed || match.player.energy < 2) return;
    e.preventDefault();
    drag.current = { tracking: true, active: false, kind: "power", iid: "power", startX: e.clientX, startY: e.clientY };
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.tracking) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.active && dx * dx + dy * dy < 64) return;
      if (!d.active) {
        d.active = true;
        document.body.classList.add("dragging");
        const inst =
          d.kind === "hand"
            ? matchRef.current.player.hand.find((c) => c.iid === d.iid)
            : d.kind === "attacker"
              ? matchRef.current.player.board.find((c) => c.iid === d.iid)
              : undefined;
        setGhost({ x: e.clientX, y: e.clientY, cardId: inst?.cardId, kind: d.kind! });
        if (d.kind === "hand" && inst) {
          const def = resolveCard(inst.cardId);
          setHint(def ? hintForHand(def, matchRef.current) : EMPTY_HINT);
        } else if (d.kind === "attacker") {
          setHint(hintForAttack(matchRef.current, d.iid));
        } else if (d.kind === "power") {
          setHint({
            ...EMPTY_HINT,
            face: true,
            legalIids: matchRef.current.ai.board.map((m) => m.iid),
          });
        }
      } else {
        setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.tracking) return;
      const was = d.active;
      const kind = d.kind;
      const iid = d.iid;
      d.tracking = false;
      d.active = false;
      document.body.classList.remove("dragging");
      setGhost(null);
      setHint(EMPTY_HINT);
      if (!was || !kind) return;
      dragConsumed.current = true;
      const ghostEl = document.getElementById("drag-ghost");
      if (ghostEl) ghostEl.style.pointerEvents = "none";
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const zone = readDrop(hit);
      if (kind === "hand") {
        if (zone?.type === "enemy") void playHand(iid, { minionIid: zone.iid, minionOwner: "ai" });
        else if (zone?.type === "face") void playHand(iid, { hero: "ai" });
        else if (zone?.type === "hero") void playHand(iid, { hero: "player" });
        else if (zone?.type === "ally") void playHand(iid, { minionIid: zone.iid, minionOwner: "player" });
        else if (zone?.type === "board" || zone?.type === "table" || zone?.type === "location") void playHand(iid);
      } else if (kind === "attacker") {
        if (zone?.type === "enemy") void doAttack(iid, { minionIid: zone.iid, minionOwner: "ai" });
        else if (zone?.type === "face") void doAttack(iid, { hero: "ai" });
      } else if (kind === "power") {
        if (zone?.type === "enemy") firePower({ minionIid: zone.iid, minionOwner: "ai" });
        else if (zone?.type === "face") firePower({ hero: "ai" });
        else firePower();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inspected = inspectId ? resolveCard(inspectId) : null;
  const powerReady = match.phase === "main" && !match.player.powerUsed && match.player.energy >= 2;
  const draggingIid = ghost ? drag.current.iid : null;
  const pendingAttacker =
    match.pending?.kind === "attack" && match.pending.sourceIid
      ? match.player.board.find((m) => m.iid === match.pending?.sourceIid)
      : undefined;
  const pendingAttack = pendingAttacker ? legalAttackTargets(match, "player", pendingAttacker) : null;
  const pendingSpell = match.pending?.kind === "spell" && match.pending.cardId
    ? resolveCard(match.pending.cardId)
    : undefined;
  const coach = coachFor(match);
  const liveHint: DropHint = (() => {
    if (hint.board || hint.face || hint.hero || hint.legalIids.length) return hint;
    if (pendingAttack) {
      return { ...EMPTY_HINT, face: pendingAttack.face, legalIids: pendingAttack.minions.map((m) => m.iid) };
    }
    if (pendingSpell) {
      return hintForHand(pendingSpell, match);
    }
    if (match.pending?.kind === "power") {
      return { ...EMPTY_HINT, face: true, legalIids: match.ai.board.filter((m) => !m.stealth).map((m) => m.iid) };
    }
    return EMPTY_HINT;
  })();
  const glowIids = new Set([...liveHint.legalIids, ...(coach?.highlight.enemyIids ?? [])]);
  const rejectLine = /cannot attack yet|Taunt is in the way|needs a character/i.test(match.log[0] ?? "")
    ? match.log[0]
    : null;

  return (
    <div
      className="conspiracy-table relative h-full min-h-0 flex-1 overflow-hidden"
      data-tutorial-step={match.tutorialStep ?? undefined}
    >
      <aside className="table-rail table-rail-left panel flex min-h-0 flex-col gap-2 overflow-hidden rounded-md p-3">
        <section>
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-gold">HISTORY</h3>
          <ul className="mt-1 space-y-1 font-mono text-[11px] leading-snug text-ink/80">
            {match.log.slice(0, 5).map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="min-h-0 flex-1 overflow-auto border-t border-edge pt-2">
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-gold">DOSSIER</h3>
          {inspected ? (
            <div className="mt-2">
              <CardFace card={inspected} />
              {inspected.lore && (
                <p className="mt-2 font-mono text-[11px] italic leading-relaxed text-muted">{inspected.lore}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 font-mono text-[11px] text-muted">Hover or select a card.</p>
          )}
        </section>
        <section
          className={cn(
            "border-t border-edge pt-2",
            (liveHint.location || coach?.highlight.location) && "drop-ready-ring rounded-sm coach-mark",
          )}
          data-drop="location"
          id="location-rail"
        >
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-gold">LOCATIONS</h3>
          <LocationSlot inst={match.ai.location} label="Enemy" />
          <LocationSlot inst={match.player.location} label="Yours" />
        </section>
      </aside>

      <div className="table-surface relative min-h-0 rounded-md" id="table-surface">
        {coach && (
          <aside className="coach-plaque" id="tutorial-hint" data-step={coach.id} role="status">
            <div className="coach-kicker" id="hint-title">
              {coach.title}
            </div>
            <p id="hint-text">{coach.text}</p>
          </aside>
        )}
        {rejectLine && (
          <div className="coach-reject" role="alert">
            {rejectLine}
          </div>
        )}
        <div className="player-section" id="opponent-section">
          <HeroPlaque
            side="ai"
            match={match}
            faceTarget={liveHint.face || Boolean(coach?.highlight.face)}
            onFace={() => {
              const cur = matchRef.current;
              if (cur.pending) patch(chooseTarget(cur, { hero: "ai" }));
            }}
          />
          <MinionRow
            id="ai-board"
            owner="ai"
            match={match}
            drop="enemy-row"
            legalIids={[...glowIids]}
            coachIids={coach?.highlight.enemyIids}
            onMinion={(iid) => {
              const cur = matchRef.current;
              if (cur.pending) patch(chooseTarget(cur, { minionIid: iid, minionOwner: "ai" }));
            }}
            onInspect={onInspect}
            seen={seenIids.current}
          />
        </div>
        <div className="combat-gutter rounded-full">
          <div className={cn("flex items-center gap-2", clock <= 10 && match.phase === "main" && "text-threat")}>
            <img
              src="/ui/chrome/hourglass.jpg"
              alt=""
              className={cn(
                "size-9 rounded-full object-cover outline outline-1 outline-gold/50 sm:size-11",
                clock <= 10 && match.phase === "main" && "size-7",
              )}
            />
            <span
              className={cn(
                "font-display text-xl text-cream sm:text-2xl",
                clock <= 10 && match.phase === "main" && "text-3xl text-threat",
              )}
            >
              {match.phase === "main" ? clock : match.phase === "ai" ? "…" : "--"}
            </span>
          </div>
        </div>
        <div className="player-section" id="player-section">
          <MinionRow
            id="player-board"
            owner="player"
            match={match}
            drop="board"
            dropReady={liveHint.board}
            legalIids={[...glowIids]}
            coachReady={Boolean(coach?.highlight.readyAllies)}
            onMinion={(iid) => {
              const cur = matchRef.current;
              if (cur.pending) patch(chooseTarget(cur, { minionIid: iid, minionOwner: "player" }));
              else patch(clickAttacker(cur, iid));
            }}
            onPointerDown={onMinionDown}
            onInspect={onInspect}
            seen={seenIids.current}
          />
          <HeroPlaque
            side="player"
            match={match}
            powerReady={powerReady}
            heroTarget={liveHint.hero}
            onFace={() => {
              const cur = matchRef.current;
              if (cur.pending) patch(chooseTarget(cur, { hero: "player" }));
            }}
            onPower={() => firePower()}
            onPowerDown={onPowerDown}
          />
        </div>
      </div>

      <aside className="table-rail table-rail-right panel flex min-h-0 flex-col items-center gap-3 overflow-auto rounded-md p-3 max-lg:max-h-28 max-lg:flex-row max-lg:flex-nowrap max-lg:justify-around max-lg:gap-2 max-lg:overflow-hidden max-lg:p-2">
        <EnergyWell faction={match.player.faction} energy={match.player.energy} max={match.player.maxEnergy} />
        <div className="w-full text-center max-lg:w-auto">
          <button
            type="button"
            disabled={match.phase !== "main"}
            onClick={() => void runEndTurn()}
            className={cn("end-turn-btn", coach?.highlight.endTurn && "coach-mark")}
            aria-label="End turn"
          >
            <span className="sr-only">End turn</span>
          </button>
          <button
            type="button"
            disabled={match.phase !== "main"}
            onClick={() => void runEndTurn()}
            className={cn(
              "mt-1 block w-full font-mono text-[10px] tracking-[0.16em] text-gold",
              coach?.highlight.endTurn && "text-phosphor",
            )}
          >
            END TURN
          </button>
        </div>
        <div className="mt-auto flex flex-col items-center max-lg:mt-0" data-drop="deck">
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-gold">DECK</h3>
          <CardBack faction={match.player.faction} className="mt-1 w-16" />
          <div className="mt-1 font-display text-lg text-cream">{match.player.deck.length}</div>
        </div>
        <Link to="/play" className="font-mono text-[10px] tracking-[0.16em] text-muted no-underline hover:text-phosphor">
          MENU
        </Link>
      </aside>

      <div
        className="hand-strip col-span-full"
        onPointerEnter={() => setExpanded(true)}
        onPointerLeave={() => {
          if (drag.current.active) return;
          setExpanded(false);
          setLifted(null);
        }}
      >
        <p className={cn("drag-hint", coach && "is-coach")}>
          {coach ? (
            <>
              <span className="coach-inline-title">{coach.title}.</span> {coach.text}
            </>
          ) : (
            "Drag a card onto the table to play it. Drag a ready character onto an enemy — or their hero — to attack."
          )}
        </p>
        <div className={cn("hand-fan", expanded && "expanded")}>
          {match.player.hand.map((c, i) => {
            const def = resolveCard(c.cardId);
            if (!def) return null;
            const afford = match.player.energy >= def.cost && match.phase === "main";
            const isLifted = lifted === c.iid;
            const taught = Boolean(coach?.highlight.handNames.includes(def.name));
            return (
              <div
                key={c.iid}
                data-hand-iid={c.iid}
                className={cn(
                  "hand-card",
                  isLifted && "lifted",
                  draggingIid === c.iid && "dragging-source",
                  taught && "coach-mark",
                  !afford && "opacity-70 saturate-50",
                )}
                style={fanVars(i, match.player.hand.length, isLifted)}
                onPointerEnter={() => setLifted(c.iid)}
                onPointerDown={(e) => afford && onHandDown(e, c.iid)}
                onClick={() => {
                  if (dragConsumed.current) {
                    dragConsumed.current = false;
                    return;
                  }
                  onInspect(c.cardId);
                  if (afford) void playHand(c.iid);
                }}
              >
                <CardFace card={def} compact />
              </div>
            );
          })}
        </div>
      </div>

      {match.pending && (
        <div className="absolute bottom-36 left-1/2 z-20 -translate-x-1/2 rounded-md bg-void/90 px-4 py-2 text-center outline outline-1 outline-gold/50">
          <div className="font-mono text-[11px] text-gold">{match.pending.prompt}</div>
          <button
            type="button"
            className="mt-1 font-mono text-[10px] text-muted underline"
            onClick={() => patch(cancelTarget(match))}
          >
            cancel
          </button>
        </div>
      )}

      {ghost && (
        <div id="drag-ghost" className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.kind === "power" ? (
            <img src={powerArt(match.player.faction, true)} alt="" className="size-16 rounded-full" />
          ) : ghost.cardId && resolveCard(ghost.cardId) ? (
            ghost.kind === "attacker" ? (
              <MiniMinion
                name={resolveCard(ghost.cardId)!.name}
                atk={resolveCard(ghost.cardId)!.attack ?? 0}
                hp={resolveCard(ghost.cardId)!.health ?? 1}
                cardId={ghost.cardId}
                faction={resolveCard(ghost.cardId)!.faction}
              />
            ) : (
              <CardFace card={resolveCard(ghost.cardId)!} compact />
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

function readDrop(el: Element | null): { type: string; iid?: string } | null {
  if (!el) return null;
  const enemy = el.closest("#ai-board [data-iid]");
  if (enemy) return { type: "enemy", iid: (enemy as HTMLElement).dataset.iid };
  const ally = el.closest("#player-board [data-iid]");
  if (ally) return { type: "ally", iid: (ally as HTMLElement).dataset.iid };
  if (el.closest('[data-drop="face"]')) return { type: "face" };
  if (el.closest('[data-drop="hero"]')) return { type: "hero" };
  if (el.closest("#location-rail, [data-drop=location]")) return { type: "location" };
  if (el.closest("#player-board, [data-drop=board]")) return { type: "board" };
  if (el.closest("#table-surface")) return { type: "table" };
  return null;
}

function LocationSlot({ inst, label }: { inst: CardInst | null; label: string }) {
  const def = inst ? resolveCard(inst.cardId) : null;
  return (
    <div className="mt-1">
      <div className="font-mono text-[9px] tracking-widest text-muted">{label}</div>
      <div
        className="mt-0.5 min-h-12 rounded-sm bg-cover bg-center px-2 py-2"
        style={{ backgroundImage: "url(/ui/chrome/location-slot.jpg)" }}
      >
        {def ? (
          <div>
            <div className="font-ui text-xs font-semibold text-cream">{def.name}</div>
            <div className="line-clamp-2 font-mono text-[10px] text-paper/80">{rulesText(def)}</div>
          </div>
        ) : (
          <div className="font-mono text-[10px] text-muted">Empty</div>
        )}
      </div>
    </div>
  );
}

function EnergyWell({
  faction,
  energy,
  max,
}: {
  faction: MatchState["player"]["faction"];
  energy: number;
  max: number;
}) {
  const lit = energyCrystal(faction);
  return (
    <div className="energy-well" aria-label={`${energy} of ${max} energy`}>
      <div className="energy-count">
        {energy}/{max}
      </div>
      <div className="energy-grid">
        {Array.from({ length: 10 }).map((_, i) => (
          <img
            key={i}
            src={i < max ? lit : "/ui/energy/empty.jpg"}
            alt=""
            className={cn("energy-gem", i < energy && "lit", i >= energy && i < max && "spent", i >= max && "locked")}
          />
        ))}
      </div>
    </div>
  );
}

function HeroPlaque({
  side,
  match,
  onFace,
  onPower,
  onPowerDown,
  powerReady,
  faceTarget,
  heroTarget,
}: {
  side: SideId;
  match: MatchState;
  onFace: () => void;
  onPower?: () => void;
  onPowerDown?: (e: ReactPointerEvent) => void;
  powerReady?: boolean;
  faceTarget?: boolean;
  heroTarget?: boolean;
}) {
  const s = side === "player" ? match.player : match.ai;
  const power = POWER_META[s.faction];
  const ready = Boolean(powerReady);
  const field = s.board.length;
  const canSwing = s.board.some((m) => !m.exhausted && m.atk > 0);
  return (
    <div className={cn("hero-plaque rounded-xl", s.faction)}>
      {side === "ai" ? (
        <>
          <div className="flex items-center justify-end gap-2">
            <div>
              <div className="text-right font-mono text-[10px] tracking-widest text-cream">
                HAND {s.hand.length}
              </div>
              <div id="opp-hand" className="mt-1 flex justify-end">
                {s.hand.slice(0, 8).map((c) => (
                  <CardBack key={c.iid} faction={s.faction} className="-ml-5 w-7 first:ml-0" />
                ))}
              </div>
            </div>
          </div>
          <HeroCenter
            side={side}
            name={s.name}
            faction={s.faction}
            onFace={onFace}
            faceTarget={faceTarget}
          />
          <div className="flex items-center gap-2">
            <button type="button" id="ai-power" className={cn("hero-power", s.powerUsed && "is-off")} disabled aria-label={power.name}>
              <img src={powerArt(s.faction, !s.powerUsed)} alt="" />
              <span className="power-cost">2</span>
            </button>
            <div className="flex flex-col items-center">
              <div className="life-orb grid place-items-center font-display text-xl text-cream">{s.life}</div>
              <span className="life-caption">Life</span>
            </div>
            <div className="min-w-0">
              <div className="truncate font-mono text-[10px] tracking-widest text-cream uppercase">
                {FACTION_META[s.faction].name.replace("The ", "")}
              </div>
              <div className="font-mono text-[10px] text-muted">
                {s.energy}/{s.maxEnergy} {FACTION_META[s.faction].energy}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <div className="flex flex-col items-center">
              <div className="life-orb grid place-items-center font-display text-xl text-cream">{s.life}</div>
              <span className="life-caption">Life</span>
            </div>
            <button
              type="button"
              id="player-power"
              disabled={!ready}
              onClick={onPower}
              onPointerDown={onPowerDown}
              className={cn("hero-power", !ready && "is-off", ready && "is-ready")}
              aria-label={power.name}
              title={`${power.name} — ${power.text}`}
            >
              <img src={powerArt(s.faction, ready)} alt="" />
              <span className="power-cost">2</span>
            </button>
            <div className="min-w-0">
              <div className="truncate font-mono text-[10px] tracking-widest text-cream uppercase">
                {FACTION_META[s.faction].name.replace("The ", "")}
              </div>
              <div className="font-mono text-[10px] text-muted">{power.name}</div>
            </div>
          </div>
          <HeroCenter
            side={side}
            name={s.name}
            faction={s.faction}
            onFace={onFace}
            heroTarget={heroTarget}
          />
          <div className="flex flex-col items-start gap-1">
            <div className="field-meter" aria-hidden>
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} className={cn("pip", i < field && "filled", i < field && canSwing && "ready")} />
              ))}
            </div>
            <div className="font-mono text-[10px] tracking-widest text-cream">FIELD {field}/7</div>
          </div>
        </>
      )}
    </div>
  );
}

function HeroCenter({
  side,
  name,
  faction,
  onFace,
  faceTarget,
  heroTarget,
}: {
  side: SideId;
  name: string;
  faction: MatchState["player"]["faction"];
  onFace: () => void;
  faceTarget?: boolean;
  heroTarget?: boolean;
}) {
  return (
    <div className="hero-stack">
      <button
        type="button"
        data-drop={side === "ai" ? "face" : "hero"}
        onClick={onFace}
        className={cn("hero-frame", faceTarget && "face-targetable", heroTarget && "hero-targetable")}
        aria-label={`${name} hero`}
      >
        <img src={portraitFor(faction)} alt="" className="hero-portrait" draggable={false} />
      </button>
      <div
        className="nameplate-banner"
        style={{ ["--nameplate" as string]: `url(${nameplateArt(faction)})` }}
      >
        <span className="truncate font-display text-[11px] tracking-wide text-cream uppercase">{name}</span>
      </div>
    </div>
  );
}

function MinionRow({
  id,
  owner,
  match,
  drop,
  dropReady,
  legalIids,
  coachIids,
  coachReady,
  onMinion,
  onPointerDown,
  onInspect,
  seen,
}: {
  id: string;
  owner: SideId;
  match: MatchState;
  drop: string;
  dropReady?: boolean;
  legalIids?: string[];
  coachIids?: string[];
  coachReady?: boolean;
  onMinion: (iid: string) => void;
  onPointerDown?: (e: ReactPointerEvent, iid: string) => void;
  onInspect: (id: string) => void;
  seen: Set<string>;
}) {
  const side = owner === "player" ? match.player : match.ai;
  const slots = packSlots(side.board);
  const pending = match.pending;
  return (
    <div
      id={id}
      data-drop={drop}
      className={cn(
        "minion-row",
        owner === "ai" ? "mt-auto" : "mb-auto",
        dropReady && "drop-ready",
      )}
    >
      {slots.map((m, i) => {
        if (!m) return <div key={`empty-${i}`} className="minion-slot empty" />;
        const def = resolveCard(m.cardId);
        const selected = pending?.sourceIid === m.iid;
        const targetable = Boolean(legalIids?.includes(m.iid));
        const ready =
          owner === "player" && match.phase === "main" && !m.exhausted && m.atk > 0 && !pending;
        const entering = !seen.has(m.iid);
        return (
          <div key={m.iid} className="minion-slot">
            <MiniMinion
              iid={m.iid}
              cardId={m.cardId}
              faction={def?.faction}
              name={def?.name ?? "?"}
              atk={auraAtk(match, owner, m)}
              hp={m.hp}
              exhausted={m.exhausted}
              taunt={m.taunt}
              stealth={m.stealth}
              selected={selected}
              targetable={targetable}
              ready={ready}
              coached={Boolean((ready && coachReady) || coachIids?.includes(m.iid))}
              onClick={() => {
                onInspect(m.cardId);
                onMinion(m.iid);
              }}
              onPointerDown={onPointerDown ? (e) => onPointerDown(e, m.iid) : undefined}
            />
            {entering ? <EnteringMark iid={m.iid} seen={seen} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function EnteringMark({ iid, seen }: { iid: string; seen: Set<string> }) {
  useEffect(() => {
    const el = unitEl(iid);
    el?.classList.add("enter");
    const t = window.setTimeout(() => {
      el?.classList.remove("enter");
      seen.add(iid);
    }, 400);
    return () => window.clearTimeout(t);
  }, [iid, seen]);
  return null;
}
