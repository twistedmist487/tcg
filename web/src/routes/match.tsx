import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { CardBack, CardFace, MiniMinion } from "@/components/cards/CardFace";
import { resolveCard } from "@/lib/game/catalog";
import {
  cancelTarget,
  chooseTarget,
  clickAttacker,
  clickHeroPower,
  confirmMulligan,
  endTurn,
  playFromHand,
} from "@/lib/game/engine";
import { portraitFor } from "@/lib/game/catalog";
import { FACTION_META } from "@/lib/game/types";
import { useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CardInst, MatchState, SideId } from "@/lib/game/types";

export const Route = createFileRoute("/match")({ component: MatchPage });

function MatchPage() {
  const archive = useArchive();
  const nav = useNavigate();
  const match = archive.match;
  const [mull, setMull] = useState<string[]>([]);
  const [inspect, setInspect] = useState<string | null>(null);

  if (!match) {
    return (
      <TerminalFrame>
        <div className="panel flex flex-1 flex-col items-center justify-center gap-3 rounded-lg p-8">
          <p className="font-mono text-sm text-muted">No live session. The archive is quiet.</p>
          <Link to="/play" className="metal-btn-live rounded-md px-4 py-2 font-ui tracking-[0.16em] text-phosphor no-underline">
            RETURN TO PLAY
          </Link>
        </div>
      </TerminalFrame>
    );
  }

  const patch = (next: MatchState) => {
    archive.setMatch(next);
    if (next.phase === "over" && next.winner) {
      const won = next.winner === "player";
      archive.recordMatch(won);
      archive.addXp(won ? 180 : 60);
      archive.addCredits(won ? 80 : 20);
      if (won) archive.completeMission(next.encounterId);
    }
  };

  const inspected = inspect ? resolveCard(inspect) : null;

  return (
    <TerminalFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
        <section className="panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
          {match.phase === "mulligan" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-auto bg-void/90 p-4">
              <h2 className="font-display text-2xl text-paper">Redraw the leak</h2>
              <p className="mt-1 font-mono text-[11px] text-muted">Tap cards to throw them back. Keep 4.</p>
              <div className="mt-4 flex max-w-full gap-2 overflow-x-auto px-2">
                {match.player.hand.map((c) => {
                  const def = resolveCard(c.cardId);
                  if (!def) return null;
                  const on = mull.includes(c.iid);
                  return (
                    <button
                      key={c.iid}
                      type="button"
                      onClick={() =>
                        setMull((m) => (m.includes(c.iid) ? m.filter((x) => x !== c.iid) : [...m, c.iid]))
                      }
                      className={cn("w-24 shrink-0 sm:w-28", on && "opacity-40")}
                    >
                      <CardFace card={def} compact />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="metal-btn-live mt-4 min-h-11 rounded-md px-6 font-ui tracking-[0.18em] text-phosphor"
                onClick={() => patch(confirmMulligan(match, mull))}
              >
                CONFIRM HAND
              </button>
            </div>
          )}

          {match.phase === "over" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-void/90 p-6 text-center">
              <div className="font-mono text-[10px] tracking-[0.22em] text-phosphor">SESSION CLOSED</div>
              <h2 className="mt-2 font-display text-4xl text-glitch text-paper">
                {match.winner === "player" ? "YOU SAW TOO MUCH" : "THE SYSTEM HELD"}
              </h2>
              <p className="mt-2 font-mono text-sm text-muted">
                {match.winner === "player" ? "Dossier updated. Credits wired." : "Burn the notes. Try another angle."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="metal-btn-live min-h-11 rounded-md px-5 font-ui tracking-[0.16em] text-phosphor"
                  onClick={() => {
                    archive.setMatch(null);
                    void nav({ to: "/play" });
                  }}
                >
                  ARCHIVE
                </button>
                <Link
                  to="/missions"
                  className="metal-btn inline-flex min-h-11 items-center rounded-md px-5 font-ui tracking-[0.16em] text-ink no-underline"
                >
                  MISSIONS
                </Link>
              </div>
            </div>
          )}

          <Tray side="ai" match={match} onHero={() => {
            if (match.pending) patch(chooseTarget(match, { hero: "ai" }));
          }} />

          <Board
            owner="ai"
            match={match}
            onMinion={(iid) => {
              if (match.pending) patch(chooseTarget(match, { minionIid: iid, minionOwner: "ai" }));
            }}
          />

          <div className="flex items-center justify-center py-1">
            <div className="h-px w-1/2 bg-edge" />
            <span className="px-3 font-mono text-[10px] tracking-[0.2em] text-muted">
              T{match.turn} · {match.current === "player" ? "YOUR MOVE" : "THEY THINK"}
            </span>
            <div className="h-px w-1/2 bg-edge" />
          </div>

          <Board
            owner="player"
            match={match}
            onMinion={(iid) => {
              if (match.pending) patch(chooseTarget(match, { minionIid: iid, minionOwner: "player" }));
              else patch(clickAttacker(match, iid));
            }}
          />

          <Tray
            side="player"
            match={match}
            onHero={() => {
              if (match.pending) patch(chooseTarget(match, { hero: "player" }));
            }}
            onPower={() => patch(clickHeroPower(match))}
            onEnd={() => patch(endTurn(match))}
          />

          <div className="flex gap-2 overflow-x-auto px-2 pb-3 pt-1">
            {match.player.hand.map((c) => {
              const def = resolveCard(c.cardId);
              if (!def) return null;
              const afford = match.player.energy >= def.cost && match.phase === "main";
              return (
                <button
                  key={c.iid}
                  type="button"
                  disabled={!afford}
                  onClick={() => {
                    setInspect(c.cardId);
                    patch(playFromHand(match, c.iid));
                  }}
                  className={cn("w-[5.5rem] shrink-0 sm:w-28", !afford && "opacity-50")}
                >
                  <CardFace card={def} compact />
                </button>
              );
            })}
          </div>

          {match.pending && (
            <div className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-md bg-void/90 px-4 py-2 text-center outline outline-1 outline-phosphor/40">
              <div className="font-mono text-[11px] text-phosphor">{match.pending.prompt}</div>
              <button
                type="button"
                className="mt-1 font-mono text-[10px] text-muted underline"
                onClick={() => patch(cancelTarget(match))}
              >
                cancel
              </button>
            </div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-64">
          <div className="panel rounded-lg p-3">
            <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">DOSSIER</div>
            {inspected ? (
              <div className="mt-2">
                <CardFace card={inspected} />
                {inspected.lore && (
                  <p className="mt-2 font-mono text-[11px] italic leading-relaxed text-muted">{inspected.lore}</p>
                )}
              </div>
            ) : (
              <p className="mt-2 font-mono text-[11px] text-muted">Hover a file. The record fills itself.</p>
            )}
          </div>
          <div className="panel flex-1 rounded-lg p-3">
            <div className="font-mono text-[10px] tracking-[0.2em] text-threat">HISTORY</div>
            <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-ink/80">
              {match.log.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </TerminalFrame>
  );
}

function Tray({
  side,
  match,
  onHero,
  onPower,
  onEnd,
}: {
  side: SideId;
  match: MatchState;
  onHero: () => void;
  onPower?: () => void;
  onEnd?: () => void;
}) {
  const s = side === "player" ? match.player : match.ai;
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <button type="button" onClick={onHero} className="flex items-center gap-2">
        <img
          src={portraitFor(s.faction)}
          alt=""
          className="size-12 rounded-sm object-cover object-top outline outline-1 outline-white/10 sm:size-14"
        />
        <span className="text-left">
          <span className="block font-ui text-sm font-semibold leading-tight">{s.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {FACTION_META[s.faction].energy}
          </span>
        </span>
      </button>
      <span className="rounded-sm bg-threat/80 px-2 py-1 font-mono text-sm text-paper">{s.life}</span>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-1.5 rounded-sm",
              i < s.energy ? "bg-phosphor" : i < s.maxEnergy ? "bg-phosphor-dim" : "bg-edge",
            )}
          />
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {side === "ai" && (
          <div className="flex">
            {s.hand.slice(0, 7).map((c) => (
              <CardBack key={c.iid} faction={s.faction} className="-ml-6 w-8 first:ml-0" />
            ))}
          </div>
        )}
        {onPower && (
          <button
            type="button"
            disabled={s.powerUsed || s.energy < 2 || match.phase !== "main"}
            onClick={onPower}
            className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-widest disabled:opacity-40"
          >
            POWER
          </button>
        )}
        {onEnd && (
          <button
            type="button"
            disabled={match.phase !== "main"}
            onClick={onEnd}
            className="metal-btn-live min-h-11 rounded-md px-4 font-ui text-xs font-semibold tracking-[0.16em] text-phosphor disabled:opacity-40"
          >
            END TURN
          </button>
        )}
      </div>
    </div>
  );
}

function Board({
  owner,
  match,
  onMinion,
}: {
  owner: SideId;
  match: MatchState;
  onMinion: (iid: string) => void;
}) {
  const board = owner === "player" ? match.player.board : match.ai.board;
  const loc = owner === "player" ? match.player.location : match.ai.location;
  const locDef = loc ? resolveCard(loc.cardId) : null;
  return (
    <div className="flex min-h-24 items-center justify-center gap-2 px-3 py-2">
      {locDef && (
        <div className="hidden w-16 sm:block">
          <CardFace card={locDef} compact />
        </div>
      )}
      {board.length === 0 && (
        <div className="font-mono text-[10px] tracking-[0.18em] text-muted">EMPTY FIELD</div>
      )}
      {board.map((m: CardInst) => {
        const def = resolveCard(m.cardId);
        return (
          <MiniMinion
            key={m.iid}
            name={def?.name ?? "?"}
            atk={m.atk}
            hp={m.hp}
            exhausted={m.exhausted}
            taunt={m.taunt}
            stealth={m.stealth}
            selected={match.pending?.sourceIid === m.iid}
            onClick={() => onMinion(m.iid)}
          />
        );
      })}
    </div>
  );
}
