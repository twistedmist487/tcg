import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons, PageHeader } from "@/components/nav/NavButtons";
import { ENCOUNTERS } from "@/lib/game/catalog";
import { matchFromEncounter } from "@/lib/game/launch";
import { callsignOf } from "@/lib/game/cosmetics";
import { useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/missions")({ component: MissionsPage });

function MissionsPage() {
  const archive = useArchive();
  const nav = useNavigate();
  const deck = archive.decks.find((d) => d.id === archive.activeDeckId) ?? archive.decks[0]!;

  const launch = (id: string) => {
    const status = archive.missions[id] ?? "available";
    if (status === "locked") return;
    archive.setMatch(
      matchFromEncounter(id, deck, {
        playerName: callsignOf(archive.handle, archive.cosmeticsLoadout?.title ?? "title-archive"),
      }),
    );
    void nav({ to: "/match" });
  };

  const campaign = [
    {
      id: "illuminati",
      title: "The Inner Circle",
      blurb: "City initiation, then HQ. Heroic on the hub. Field cards and locker sleeves.",
    },
  ];

  const challenges = ENCOUNTERS.filter((e) => e.mode === "challenge" || e.mode === "tutorial" || e.mode === "lab");

  return (
    <TerminalFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel rounded-lg p-3">
            <NavButtons active="missions" />
          </div>
        </aside>
        <section className="panel min-h-0 flex-1 overflow-auto rounded-lg p-4 sm:p-6">
          <PageHeader kicker="// CLASSIFIED OBJECTIVES" title="Missions" />

          <h2 className="font-mono text-[10px] tracking-[0.22em] text-phosphor">CAMPAIGN</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {campaign.map((c) => {
              const st = archive.missions[c.id] ?? "available";
              const live = Boolean(archive.campaignRun);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={st === "locked"}
                  onClick={() => void nav({ to: "/campaign" })}
                  className={cn(
                    "rounded-lg p-4 text-left",
                    st === "complete" || live ? "metal-btn-live" : "metal-btn",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-ui text-lg font-semibold">{c.title}</span>
                    <StatusChip status={st === "complete" ? "complete" : live ? "available" : st} />
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">{c.blurb}</p>
                  <div className="mt-2 font-mono text-[10px] tracking-[0.16em] text-watch">
                    {live
                      ? archive.campaignRun?.boardId === "hq"
                        ? "RESUME LODGE"
                        : "RESUME CITY BOARD"
                      : st === "complete"
                        ? "CHAPTER ON FILE"
                        : "OPEN INITIATION"}
                  </div>
                </button>
              );
            })}
          </div>

          <h2 className="mt-8 font-mono text-[10px] tracking-[0.22em] text-threat">HARD ROOM</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {challenges.map((enc) => {
              const st = archive.missions[enc.id] ?? (enc.mode === "challenge" ? "locked" : "available");
              const locked = st === "locked";
              return (
                <button
                  key={enc.id}
                  type="button"
                  disabled={locked}
                  onClick={() => launch(enc.id)}
                  className={cn("rounded-lg p-4 text-left", locked ? "metal-btn opacity-60" : "metal-btn hover:brightness-110")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-ui text-lg font-semibold text-ink">{enc.name}</span>
                    {locked ? <Lock className="size-4 text-muted" /> : <StatusChip status={st} />}
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">{enc.description}</p>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-phosphor">
                    {enc.difficulty} · {enc.ai_name}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </TerminalFrame>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = status === "complete" ? "CLEARED" : status === "locked" ? "SEALED" : "OPEN";
  const color = status === "complete" ? "text-phosphor" : status === "locked" ? "text-threat" : "text-watch";
  return <span className={cn("font-mono text-[10px] tracking-[0.18em]", color)}>{label}</span>;
}