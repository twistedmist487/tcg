import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons, PageHeader } from "@/components/nav/NavButtons";
import { CardFace } from "@/components/cards/CardFace";
import { cardsByFaction, rarityOf } from "@/lib/game/catalog";
import type { CardDef, FactionId } from "@/lib/game/types";
import { FACTION_META } from "@/lib/game/types";
import { useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store")({ component: StorePage });

type Pack = {
  id: string;
  name: string;
  blurb: string;
  price: number;
  faction: FactionId;
};

const PACKS: Pack[] = [
  { id: "illuminati", name: "Lodge Bundle", blurb: "Five Influence files. Strings included.", price: 100, faction: "illuminati" },
  { id: "templars", name: "Chapel Bundle", blurb: "Five Faith files. Relics rattle.", price: 100, faction: "templars" },
  { id: "reptilians", name: "Hive Bundle", blurb: "Five Psionic files. Something hatches.", price: 100, faction: "reptilians" },
  { id: "neutral", name: "Dead Drop", blurb: "Five Network hires. No questions.", price: 80, faction: "neutral" },
];

function rollPack(faction: FactionId): CardDef[] {
  const pool = cardsByFaction(faction).filter((c) => c.id !== "neutral_char_008");
  const out: CardDef[] = [];
  for (let i = 0; i < 5; i++) {
    const r = Math.random();
    const want = r > 0.92 ? "legendary" : r > 0.72 ? "rare" : r > 0.4 ? "uncommon" : "common";
    const slice = pool.filter((c) => rarityOf(c) === want);
    const bag = slice.length ? slice : pool;
    out.push(bag[Math.floor(Math.random() * bag.length)]!);
  }
  return out;
}

function StorePage() {
  const archive = useArchive();
  const [opening, setOpening] = useState<CardDef[] | null>(null);
  const [flip, setFlip] = useState(0);
  const [err, setErr] = useState("");

  const buy = (pack: Pack) => {
    if (archive.credits < pack.price) {
      setErr("Insufficient black budget.");
      return;
    }
    setErr("");
    archive.addCredits(-pack.price);
    const cards = rollPack(pack.faction);
    for (const c of cards) archive.grantCard(c.id, 1);
    useArchive.setState({ packsOpened: archive.packsOpened + 1 });
    setOpening(cards);
    setFlip(0);
  };

  const revealed = useMemo(() => opening?.slice(0, flip) ?? [], [opening, flip]);

  return (
    <TerminalFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel rounded-lg p-3">
            <NavButtons active="store" />
          </div>
        </aside>
        <section className="panel min-h-0 flex-1 overflow-auto rounded-lg p-4 sm:p-6">
          <PageHeader
            kicker="// ANONYMOUS EXCHANGE"
            title="Store"
            action={
              <div className="font-mono text-sm tracking-[0.14em] text-watch">
                ₡ {archive.credits}
              </div>
            }
          />
          {err && <p className="mb-3 font-mono text-xs text-threat">{err}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {PACKS.map((p) => (
              <article key={p.id} className="metal-btn rounded-lg p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-phosphor">
                  {FACTION_META[p.faction].name}
                </div>
                <h2 className="mt-1 font-ui text-xl font-semibold">{p.name}</h2>
                <p className="mt-2 font-mono text-[12px] leading-relaxed text-muted">{p.blurb}</p>
                <button
                  type="button"
                  onClick={() => buy(p)}
                  className="metal-btn-live mt-4 min-h-11 w-full rounded-md font-ui text-sm tracking-[0.18em] text-phosphor"
                >
                  BUY · ₡{p.price}
                </button>
              </article>
            ))}
          </div>
          <p className="mt-6 font-mono text-[11px] text-muted">
            No names. No receipts. Packs wire into your collection. Duplicates stack.
          </p>
        </section>
      </div>

      {opening && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-void/80 p-4">
          <div className="font-mono text-[10px] tracking-[0.22em] text-phosphor">DEAD DROP INCOMING</div>
          <div className="mt-6 flex max-w-full gap-2 overflow-x-auto">
            {opening.map((c, i) => (
              <div key={`${c.id}-${i}`} className="w-28 shrink-0 sm:w-36">
                {i < flip ? (
                  <CardFace card={c} />
                ) : (
                  <button
                    type="button"
                    className="aspect-[5/7] w-full rounded-md bg-panel-2 outline outline-1 outline-phosphor/30"
                    onClick={() => setFlip((n) => Math.max(n, i + 1))}
                  >
                    <span className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.2em] text-muted">
                      TAP
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="metal-btn mt-6 min-h-11 rounded-md px-5 font-mono text-xs tracking-[0.16em]"
            onClick={() => {
              if (flip < 5) setFlip(5);
              else setOpening(null);
            }}
          >
            {flip < 5 ? "REVEAL ALL" : "STASH FILES"}
          </button>
          {revealed.length === 5 && (
            <p className="mt-2 font-mono text-[11px] text-muted">Wired to the record.</p>
          )}
        </div>
      )}
    </TerminalFrame>
  );
}
