import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { CardFace } from "@/components/cards/CardFace";
import { TableMatch } from "@/components/match/TableMatch";
import { resolveCard } from "@/lib/game/catalog";
import { confirmMulligan } from "@/lib/game/engine";
import { useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { MatchState } from "@/lib/game/types";

export const Route = createFileRoute("/match")({ component: MatchPage });

function MatchPage() {
  const archive = useArchive();
  const nav = useNavigate();
  const match = archive.match;
  const [mull, setMull] = useState<string[]>([]);
  const [inspect, setInspect] = useState<string | null>(null);

  if (!match) {
    return (
      <TerminalFrame compact>
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
    if (next.phase === "over" && next.winner && match.phase !== "over") {
      const won = next.winner === "player";
      archive.recordMatch(won);
      archive.addXp(won ? 180 : 60);
      if (match.campaign) {
        if (won) archive.completeCampaignNode(match.campaign.nodeId);
      } else {
        archive.addCredits(won ? 80 : 20);
        if (won) archive.completeMission(next.encounterId);
      }
    }
  };

  return (
    <TerminalFrame compact>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {match.phase === "mulligan" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-auto bg-void/90 p-4">
            <h2 className="font-display text-2xl text-paper">Redraw the leak</h2>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {match.encounterId === "tutorial"
                ? "Keep Squire. Tap any other card to throw it back. You want the 1-cost Taunt."
                : "Tap cards to throw them back. Keep 4."}
            </p>
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
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-void/90 p-6 text-center">
            <div className="font-mono text-[10px] tracking-[0.22em] text-phosphor">SESSION CLOSED</div>
            <h2 className="mt-2 font-display text-4xl text-glitch text-paper">
              {match.winner === "player"
                ? match.campaign?.lessonWin ?? (match.crisis ? "YOU LASTED" : "YOU SAW TOO MUCH")
                : match.campaign?.lessonLoss ?? "THE SYSTEM HELD"}
            </h2>
            <p className="mt-2 font-mono text-sm text-muted">
              {match.campaign
                ? match.winner === "player"
                  ? "Ledger updated. Return to the board."
                  : "The node still has you. Try again."
                : match.winner === "player"
                  ? "Dossier updated. Credits wired."
                  : "Burn the notes. Try another angle."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="metal-btn-live min-h-11 rounded-md px-5 font-ui tracking-[0.16em] text-phosphor"
                onClick={() => {
                  archive.setMatch(null);
                  void nav({ to: match.campaign ? "/campaign" : "/play" });
                }}
              >
                {match.campaign ? "BOARD" : "ARCHIVE"}
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

        <TableMatch match={match} inspectId={inspect} onChange={patch} onInspect={setInspect} />
      </div>
    </TerminalFrame>
  );
}
