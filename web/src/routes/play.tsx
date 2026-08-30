import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FlaskConical, GraduationCap, Swords, BookOpen } from "lucide-react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons, PageHeader } from "@/components/nav/NavButtons";
import { useArchive } from "@/lib/store";
import { ENCOUNTERS } from "@/lib/game/catalog";
import { matchFromEncounter } from "@/lib/game/launch";

export const Route = createFileRoute("/play")({ component: PlayHub });

function PlayHub() {
  const nav = useNavigate();
  const archive = useArchive();
  const deck = archive.decks.find((d) => d.id === archive.activeDeckId) ?? archive.decks[0]!;

  const launch = (id: string) => {
    const match = matchFromEncounter(id, deck, { playerName: archive.handle });
    archive.setMatch(match);
    void nav({ to: "/match" });
  };

  const rows = [
    {
      id: "tutorial",
      icon: GraduationCap,
      kicker: "PROTOCOL 01",
      title: "First Contact",
      blurb: "Guided match. Learn energy, Taunt, Deathrattle, spells, and Charge as Recruit vs The Recruiter.",
    },
    {
      id: "keyword_lab",
      icon: FlaskConical,
      kicker: "PROTOCOL 02",
      title: "Keyword Lab",
      blurb: "Skippable drill: Recycle, Split, Drain, Ward on a live board vs The Instructor.",
    },
    {
      id: "skirmish",
      icon: Swords,
      kicker: "SHADOW NET",
      title: "Vs AI Handler",
      blurb: "Pick your dossier, their conspiracy, and how hard they think.",
    },
  ];

  const showcases = ENCOUNTERS.filter((e) => e.mode === "showcase");

  return (
    <TerminalFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel rounded-lg p-3">
            <NavButtons active="play" />
          </div>
        </aside>
        <section className="panel min-h-0 flex-1 overflow-auto rounded-lg p-4 sm:p-6">
          <PageHeader
            kicker="// ENTER THE ARCHIVE"
            title="Play"
            action={
              <div className="font-mono text-[10px] tracking-[0.16em] text-muted">
                ACTIVE DOSSIER · {deck.name}
              </div>
            }
          />
          <div className="grid gap-3 md:grid-cols-3">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => (row.id === "skirmish" ? nav({ to: "/setup" }) : launch(row.id))}
                  className="metal-btn flex flex-col items-start gap-3 rounded-lg p-4 text-left transition-transform duration-150 hover:brightness-110 active:scale-[0.98]"
                >
                  <span className="flex size-10 items-center justify-center rounded-sm bg-phosphor-deep text-phosphor">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.2em] text-phosphor">{row.kicker}</span>
                  <span className="font-ui text-xl font-semibold tracking-wide text-ink">{row.title}</span>
                  <span className="font-mono text-[11px] leading-relaxed text-muted">{row.blurb}</span>
                </button>
              );
            })}
          </div>

          <h2 className="mt-8 font-mono text-[10px] tracking-[0.22em] text-muted">SHOWCASE MATCHUPS</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {showcases.map((enc) => (
              <button
                key={enc.id}
                type="button"
                onClick={() => launch(enc.id)}
                className="metal-btn rounded-lg p-4 text-left hover:brightness-110"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-phosphor">
                  {enc.player_faction} vs {enc.ai_faction}
                </div>
                <div className="mt-1 font-ui text-lg font-semibold text-ink">{enc.name}</div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">{enc.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-8 flex items-start gap-3 rounded-md bg-void/50 p-4 outline outline-1 outline-edge">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-phosphor" />
            <div>
              <div className="font-ui text-sm font-semibold tracking-wide">How a match works</div>
              <p className="mt-1 max-w-3xl font-mono text-[12px] leading-relaxed text-muted text-pretty">
                30-card dossier, 30 life, energy starts at 1 and grows each turn. Play characters (max 7),
                spells, and one location. Taunt must be hit first. Stealth hides until it attacks. Charge
                swings the turn it lands. Reduce them to 0 — or make them draw dead.
              </p>
            </div>
          </div>
        </section>
      </div>
    </TerminalFrame>
  );
}
