import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { PageHeader } from "@/components/nav/NavButtons";
import { CardFace } from "@/components/cards/CardFace";
import { CARDS, deckCount, getCard, networkCount } from "@/lib/game/catalog";
import { FACTION_META, type CardDef, type DeckList, type FactionId } from "@/lib/game/types";
import { ownedCopies, useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/decks/$id")({ component: DeckEditor });

function DeckEditor() {
  const { id } = Route.useParams();
  const archive = useArchive();
  const nav = useNavigate();
  const original = archive.decks.find((d) => d.id === id);
  const [draft, setDraft] = useState<DeckList | null>(original ?? null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"faction" | "network">("faction");

  const pool = useMemo(() => {
    if (!draft) return [];
    const fac = tab === "network" ? "neutral" : draft.faction;
    return CARDS.filter((c) => {
      if (c.faction !== fac) return false;
      if (c.id === "neutral_char_008") return false;
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      return ownedCopies(archive.collection, c.id) > 0;
    });
  }, [draft, tab, q, archive.collection]);

  if (!draft) {
    return (
      <TerminalFrame>
        <div className="panel flex flex-1 items-center justify-center rounded-lg">
          <p className="font-mono text-sm text-muted">File missing.</p>
        </div>
      </TerminalFrame>
    );
  }

  const count = deckCount(draft.cards);
  const net = networkCount(draft.cards);

  const copiesOf = (cid: string) => draft.cards.find((r) => r.id === cid)?.copies ?? 0;

  const add = (card: CardDef) => {
    const have = ownedCopies(archive.collection, card.id);
    const now = copiesOf(card.id);
    if (now >= 2 || now >= have || count >= 30) return;
    if (card.faction === "neutral" && net >= 12 && now === 0) return;
    const cards = draft.cards.map((r) => (r.id === card.id ? { ...r, copies: r.copies + 1 } : r));
    if (!draft.cards.some((r) => r.id === card.id)) cards.push({ id: card.id, copies: 1 });
    setDraft({ ...draft, cards });
  };

  const sub = (cid: string) => {
    const cards = draft.cards
      .map((r) => (r.id === cid ? { ...r, copies: r.copies - 1 } : r))
      .filter((r) => r.copies > 0);
    setDraft({ ...draft, cards });
  };

  const setFaction = (f: Exclude<FactionId, "neutral">) => {
    const cards = draft.cards.filter((r) => {
      const c = getCard(r.id);
      return c && (c.faction === f || c.faction === "neutral");
    });
    setDraft({ ...draft, faction: f, cards });
  };

  return (
    <TerminalFrame>
      <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg p-4 sm:p-5">
        <PageHeader
          kicker="// DOSSIER EDITOR"
          title={draft.name}
          action={
            <div className="flex flex-wrap gap-2">
              <Link to="/decks" className="metal-btn inline-flex min-h-11 items-center rounded-md px-3 font-mono text-xs no-underline">
                BACK
              </Link>
              <button
                type="button"
                className="metal-btn-live min-h-11 rounded-md px-4 font-ui text-sm tracking-[0.14em] text-phosphor"
                onClick={() => {
                  archive.saveDeck(draft);
                  void nav({ to: "/decks" });
                }}
              >
                SEAL FILE
              </button>
            </div>
          }
        />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="min-h-11 min-w-48 flex-1 rounded-md bg-void px-3 font-ui text-sm outline outline-1 outline-edge focus:outline-phosphor"
          />
          {(["illuminati", "templars", "reptilians"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFaction(f)}
              className={cn(
                "min-h-11 rounded-md px-3 font-mono text-[11px] uppercase tracking-widest",
                draft.faction === f ? "metal-btn-live text-phosphor" : "metal-btn",
              )}
            >
              {FACTION_META[f].name.replace("The ", "")}
            </button>
          ))}
          <span className="font-mono text-[11px] text-muted">
            {count}/30 · NET {net}/12
          </span>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_280px]">
          <div className="min-h-0 overflow-auto">
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setTab("faction")}
                className={cn("min-h-9 rounded-md px-3 font-mono text-[11px]", tab === "faction" ? "metal-btn-live" : "metal-btn")}
              >
                FACTION
              </button>
              <button
                type="button"
                onClick={() => setTab("network")}
                className={cn("min-h-9 rounded-md px-3 font-mono text-[11px]", tab === "network" ? "metal-btn-live" : "metal-btn")}
              >
                NETWORK
              </button>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search files"
                className="min-h-9 flex-1 rounded-md bg-void px-3 font-mono text-xs outline outline-1 outline-edge"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {pool.map((c) => (
                <CardFace
                  key={c.id}
                  card={c}
                  copies={ownedCopies(archive.collection, c.id)}
                  onClick={() => add(c)}
                />
              ))}
            </div>
          </div>
          <aside className="max-h-[50vh] overflow-auto rounded-md bg-void/40 p-2 lg:max-h-none">
            <div className="font-mono text-[10px] tracking-[0.18em] text-phosphor">LIST</div>
            <ul className="mt-2 space-y-1">
              {draft.cards.map((r) => {
                const c = getCard(r.id);
                if (!c) return null;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <button type="button" className="text-left text-ink" onClick={() => sub(r.id)}>
                      {c.name}
                    </button>
                    <span className="text-muted">×{r.copies}</span>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </section>
    </TerminalFrame>
  );
}
