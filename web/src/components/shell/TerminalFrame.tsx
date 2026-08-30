import { Link, useRouterState } from "@tanstack/react-router";
import { Lock, Signal } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn, formatXp } from "@/lib/utils";
import { useArchive } from "@/lib/store";
import { NAV } from "@/components/nav/items";
import { NavButtons } from "@/components/nav/NavButtons";

function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const glyphs = "01アイウエオカキクケコ01ΞΨΩΔ†‡§".split("");
    let cols = 0;
    let drops: number[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(canvas.clientWidth / 14);
      drops = Array.from({ length: cols }, () => Math.random() * 40);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const tick = () => {
      ctx.fillStyle = "rgba(7,9,10,0.18)";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.font = "12px 'Share Tech Mono', monospace";
      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[(Math.random() * glyphs.length) | 0]!;
        ctx.fillStyle = i % 9 === 0 ? "rgba(124,255,154,0.85)" : "rgba(61,138,82,0.45)";
        ctx.fillText(ch, i * 14, drops[i]! * 14);
        drops[i] = drops[i]! > canvas.clientHeight / 14 + Math.random() * 18 ? 0 : drops[i]! + 1;
      }
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    else {
      ctx.fillStyle = "#07090a";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
      aria-hidden="true"
    />
  );
}

const NAV_LOCAL = NAV;

export function navActive(pathname: string) {
  if (pathname === "/") return "play";
  const hit = NAV_LOCAL.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
  return hit?.id ?? "";
}

export function TerminalFrame({
  children,
  section,
}: {
  children: ReactNode;
  section?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const agent = useArchive();
  const active = section ?? navActive(pathname);
  const home = pathname === "/";

  return (
    <div className="relative h-dvh overflow-hidden bg-void text-ink">
      <MatrixRain />
      <div className="scan-mask absolute inset-0 z-10 opacity-40" />
      <div className="relative z-20 mx-auto flex h-dvh max-w-[1440px] flex-col px-2 py-2 sm:px-3 sm:py-3">
        <header className="panel mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-3 py-2 sm:px-4">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <img
              src="/art/eye.jpg"
              alt=""
              className="size-9 rounded-sm object-cover outline outline-1 -outline-offset-1 outline-phosphor/30 sm:size-10"
            />
            <div>
              <div className="font-display text-xl leading-none tracking-wide text-phosphor text-glitch sm:text-2xl">
                TRUTH.EXE
              </div>
              <div className="font-mono text-[10px] tracking-[0.18em] text-threat">
                // SYSTEM ACCESS: DENIED
              </div>
            </div>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:text-[11px]">
            <span>
              USER: <span className="text-ink">{agent.handle}</span>
            </span>
            <span>
              CLEARANCE: <span className="text-threat">[REDACTED]</span>
            </span>
            <span className="flex items-center gap-2">
              THREAT LEVEL:
              <span className="flex gap-0.5" aria-label="threat 8 of 8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="inline-block size-2 bg-threat shadow-[0_0_6px_#e23d3d]" />
                ))}
              </span>
            </span>
          </div>
        </header>

        {!home && pathname !== "/match" && (
          <div className="mb-2 lg:hidden">
            <NavButtons active={active} stacked={false} />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>

        <footer className="panel mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:px-4">
          <Link
            to="/"
            className={cn(
              "text-phosphor/80 hover:text-phosphor",
              home && "text-phosphor",
            )}
          >
            SYS_OVERVIEW
          </Link>
          <span className="hidden sm:inline">
            TRUTH.EXE BUILD 3.1.4.7 · PROTOCOL: MK-ULTRA · STATUS:{" "}
            <span className="text-threat">COMPROMISED</span>
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-phosphor">
              <Lock className="size-3" /> CONNECTION: ENCRYPTED
            </span>
            <span className="inline-flex items-center gap-1">
              SIGNAL
              <Signal className="size-3 text-phosphor" />
            </span>
          </span>
        </footer>
      </div>
      <span className="sr-only">
        Agent {agent.agentId} level {agent.level} {formatXp(agent.xp)} xp
      </span>
    </div>
  );
}
