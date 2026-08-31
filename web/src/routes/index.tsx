import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons } from "@/components/nav/NavButtons";
import { useArchive } from "@/lib/store";
import { formatXp } from "@/lib/utils";
import { callsignOf, STARTER_LOADOUT } from "@/lib/game/cosmetics";

export const Route = createFileRoute("/")({ component: Home });

const BOOT = [
  "> INITIATING TRUTH.EXE...",
  "> SCANNING ARCHIVES...",
  "> FIREWALL BREACH DETECTED",
  "> ACCESSING SHADOW_NET...",
  "[REDACTED BY ORDER 66B]",
];

const CIPHER = ["Z L I O R V G S V M R G S L R H", "Y V S R M W G S L R H"];
const PLAIN = ["THE ARCHIVE IS WATCHING", "YOU ARE THE LEAK"];

function Home() {
  const agent = useArchive();
  const [boot, setBoot] = useState(0);
  const [cam, setCam] = useState(0);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (boot >= BOOT.length) return;
    const t = window.setTimeout(() => setBoot((b) => b + 1), 420);
    return () => window.clearTimeout(t);
  }, [boot]);

  useEffect(() => {
    const t = window.setInterval(() => setCam((c) => 1 - c), 5200);
    return () => window.clearInterval(t);
  }, []);

  return (
    <TerminalFrame section="play">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto lg:grid-cols-[220px_minmax(0,1fr)_250px] lg:overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)_270px]">
        <aside className="panel flex shrink-0 flex-col gap-2 rounded-lg p-2 sm:p-3 lg:min-h-0 lg:overflow-auto">
          <NavButtons active="play" />
          <div className="mt-auto flex items-center gap-3 rounded-md bg-void/60 p-2 outline outline-1 outline-edge">
            <img
              src="/art/hero.jpg"
              alt=""
              className="size-12 rounded-sm object-cover object-top outline outline-1 -outline-offset-1 outline-white/10"
            />
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.18em] text-muted">
                {callsignOf(agent.handle, (agent.cosmeticsLoadout ?? STARTER_LOADOUT).title)}
              </div>
              <div className="font-ui text-sm font-semibold tracking-wide text-ink">
                LVL {agent.level} · {formatXp(agent.xp)} XP
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full bg-phosphor"
                  style={{ width: `${Math.min(100, (agent.xp % 400) / 4)}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        <section className="panel relative min-h-[320px] overflow-hidden rounded-lg lg:min-h-0">
          <img
            src="/art/hero.jpg"
            alt="Hooded figure in a classified archive"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/25 to-void/10" />
          <div className="scan-mask absolute inset-0 opacity-30" />
          <div className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-10 pt-8 text-center sm:pb-12">
            <p className="font-display text-[clamp(1.4rem,4.4vw,3rem)] leading-[0.95] tracking-wide text-paper text-glitch text-balance">
              THEY DON'T WANT
              <br />
              YOU TO KNOW
            </p>
            <p className="mt-2 font-mono text-[10px] tracking-[0.28em] text-threat sm:text-[11px]">
              /// TRUTH IS A THREAT TO THE SYSTEM
            </p>
            <Link
              to="/play"
              className="metal-btn-live mt-4 inline-flex min-h-11 items-center rounded-md px-6 font-ui text-sm font-semibold tracking-[0.2em] text-phosphor no-underline"
            >
              ENTER THE ARCHIVE
            </Link>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-sm bg-threat px-3 py-1 font-mono text-[10px] tracking-[0.22em] text-paper">
            YOU ARE BEING WATCHED
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-2 lg:overflow-auto">
          <div className="panel rounded-lg p-2.5">
            <div className="mb-1 font-mono text-[10px] tracking-[0.22em] text-threat">SYSTEM LOG</div>
            <ul className="space-y-0.5 font-mono text-[10px] leading-relaxed text-phosphor sm:text-[11px]">
              {BOOT.slice(0, boot).map((line) => (
                <li key={line} className={line.startsWith("[") ? "text-threat" : undefined}>
                  {line}
                </li>
              ))}
              <li className="text-muted">&nbsp;</li>
            </ul>
          </div>

          <div className="panel overflow-hidden rounded-lg">
            <div className="px-2.5 pt-2.5 font-mono text-[10px] tracking-[0.22em] text-phosphor">
              // SURVEILLANCE FEED
            </div>
            <div className="relative mt-1.5 aspect-[16/8] max-h-32 bg-void">
              <img
                src={cam === 0 ? "/art/cam-alley.jpg" : "/art/cam-garage.jpg"}
                alt="Live camera feed"
                className="h-full w-full object-cover"
              />
              <div className="scan-mask absolute inset-0 opacity-40" />
              <div className="absolute left-2 top-2 font-mono text-[10px] text-threat">REC ●</div>
            </div>
            <div className="px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-muted">
              CAM_{cam === 0 ? "17" : "04"} · LIVE
            </div>
          </div>

          <div className="panel relative rounded-lg p-2.5 pb-10">
            <div className="font-mono text-[10px] tracking-[0.22em] text-muted">HIDDEN MESSAGE</div>
            <pre className="mt-1 font-mono text-[10px] leading-relaxed text-phosphor sm:text-[11px]">
              {agent.decrypted ? PLAIN.join("\n") : CIPHER.join("\n")}
            </pre>
            <div className="mt-2 font-mono text-[10px] text-muted">-- DECRYPT? Y / N --</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="metal-btn-live min-h-9 rounded-sm px-3 font-mono text-xs text-phosphor"
                onClick={() => {
                  agent.decrypt();
                  setAsk(true);
                }}
              >
                Y
              </button>
              <button
                type="button"
                className="metal-btn min-h-9 rounded-sm px-3 font-mono text-xs text-muted"
                onClick={() => setAsk(false)}
              >
                N
              </button>
            </div>
            <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-watch">HINT: LOOK TWICE.</p>
            {ask && agent.decrypted && (
              <p className="mt-2 font-mono text-[10px] text-threat">Channel opened. Nothing is real.</p>
            )}
            <div className="absolute right-2 bottom-2 w-24 rotate-[-6deg] bg-watch px-2 py-1.5 text-void shadow-md">
              <p className="font-ui text-[10px] font-semibold leading-tight">
                NOTHING IS REAL
                <br />
                EVERYTHING IS CONNECTED
              </p>
              <img src="/art/eye.jpg" alt="" className="mt-1 h-8 w-full object-cover opacity-80" />
            </div>
          </div>
        </aside>
      </div>
    </TerminalFrame>
  );
}
