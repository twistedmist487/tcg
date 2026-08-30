import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { PageHeader } from "@/components/nav/NavButtons";
import { FACTION_META, type FactionId } from "@/lib/game/types";
import { portraitFor } from "@/lib/game/catalog";
import { matchFromSkirmish } from "@/lib/game/launch";
import { useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/setup")({ component: Setup });

const FACTIONS: Exclude<FactionId, "neutral">[] = ["illuminati", "templars", "reptilians"];

function Setup() {
  const archive = useArchive();
  const nav = useNavigate();
  const [deckId, setDeckId] = useState(archive.activeDeckId);
  const [opp, setOpp] = useState<Exclude<FactionId, "neutral">>("reptilians");
  const [diff, setDiff] = useState<"easy" | "medium" | "hard">("medium");
  const deck = archive.decks.find((d) => d.id === deckId) ?? archive.decks[0]!;

  return (
    <TerminalFrame>
      <section className="panel flex-1 overflow-auto rounded-lg p-4 sm:p-6">
        <PageHeader kicker="// SHADOW NET" title="Vs AI Handler" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="font-mono text-[10px] tracking-[0.2em] text-phosphor">YOUR DOSSIER</h2>
            <div className="mt-3 grid gap-2">
              {archive.decks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDeckId(d.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md p-3 text-left",
                    deckId === d.id ? "metal-btn-live" : "metal-btn",
                  )}
                >
                  <img
                    src={portraitFor(d.faction)}
                    alt=""
                    className="size-12 rounded-sm object-cover object-top"
                  />
                  <span>
                    <span className="block font-ui text-base font-semibold text-ink">{d.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      {FACTION_META[d.faction].name}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-mono text-[10px] tracking-[0.2em] text-threat">THEIR CONSPIRACY</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {FACTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOpp(f)}
                  className={cn(
                    "overflow-hidden rounded-md text-left",
                    opp === f ? "metal-btn-live" : "metal-btn",
                  )}
                >
                  <img src={portraitFor(f)} alt="" className="h-24 w-full object-cover object-top" />
                  <span className="block px-2 py-2 font-ui text-sm font-semibold">{FACTION_META[f].name}</span>
                </button>
              ))}
            </div>
            <h2 className="mt-6 font-mono text-[10px] tracking-[0.2em] text-muted">THREAT THINKING</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiff(d)}
                  className={cn(
                    "min-h-11 rounded-md px-4 font-ui text-sm font-semibold uppercase tracking-[0.16em]",
                    diff === d ? "metal-btn-live text-phosphor" : "metal-btn",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="metal-btn-live mt-8 min-h-12 w-full rounded-md font-ui text-sm font-semibold tracking-[0.22em] text-phosphor"
              onClick={() => {
                archive.setActiveDeck(deck.id);
                archive.setMatch(
                  matchFromSkirmish({
                    playerDeck: deck,
                    opponentFaction: opp,
                    difficulty: diff,
                    playerName: archive.handle,
                  }),
                );
                void nav({ to: "/match" });
              }}
            >
              INITIATE CONTACT
            </button>
          </div>
        </div>
      </section>
    </TerminalFrame>
  );
}
