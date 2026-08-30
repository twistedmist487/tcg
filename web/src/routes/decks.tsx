import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons, PageHeader } from "@/components/nav/NavButtons";
import { CardFace } from "@/components/cards/CardFace";
import { CURATED_DECKS, deckCount, getCard, networkCount, portraitFor } from "@/lib/game/catalog";
import { FACTION_META } from "@/lib/game/types";
import { useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/decks")({ component: DecksPage });

function DecksPage() {
  const archive = useArchive();
  const nav = useNavigate();

  const create = () => {
    const id = `custom_${Date.now()}`;
    archive.saveDeck({
      id,
      name: "New Dossier",
      faction: "illuminati",
      description: "Scratch-built from the leak.",
      cards: [],
      custom: true,
    });
    void nav({ to: "/decks/$id", params: { id } });
  };

  return (
    <TerminalFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel rounded-lg p-3">
            <NavButtons active="decks" />
          </div>
        </aside>
        <section className="panel min-h-0 flex-1 overflow-auto rounded-lg p-4 sm:p-6">
          <PageHeader
            kicker="// BUILD YOUR DOSSIER"
            title="Decks"
            action={
              <button
                type="button"
                onClick={create}
                className="metal-btn-live inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-ui text-sm tracking-[0.14em] text-phosphor"
              >
                <Plus className="size-4" /> NEW DOSSIER
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {archive.decks.map((d) => {
              const count = deckCount(d.cards);
              const net = networkCount(d.cards);
              const preview = d.cards
                .slice(0, 4)
                .map((r) => getCard(r.id))
                .filter(Boolean);
              const active = archive.activeDeckId === d.id;
              return (
                <article
                  key={d.id}
                  className={cn("overflow-hidden rounded-lg", active ? "metal-btn-live" : "metal-btn")}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-3 text-left"
                    onClick={() => archive.setActiveDeck(d.id)}
                  >
                    <img
                      src={portraitFor(d.faction)}
                      alt=""
                      className="size-14 rounded-sm object-cover object-top"
                    />
                    <span className="min-w-0">
                      <span className="block font-ui text-lg font-semibold leading-tight text-ink">
                        {d.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                        {FACTION_META[d.faction].name} · {count}/30 · NET {net}/12
                      </span>
                    </span>
                  </button>
                  <p className="px-3 pb-2 font-mono text-[11px] leading-relaxed text-muted">{d.description}</p>
                  <div className="flex gap-1 px-3 pb-3">
                    {preview.map((c) =>
                      c ? (
                        <div key={c.id} className="w-12">
                          <CardFace card={c} compact />
                        </div>
                      ) : null,
                    )}
                  </div>
                  <div className="flex justify-end px-3 pb-3">
                    <Link
                      to="/decks/$id"
                      params={{ id: d.id }}
                      className="font-mono text-[11px] tracking-[0.16em] text-phosphor no-underline"
                    >
                      OPEN FILE →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-6 font-mono text-[11px] text-muted">
            Curated lists from the vault ({CURATED_DECKS.length}). Max 30 cards, 2 copies, 12 Network.
          </p>
        </section>
      </div>
    </TerminalFrame>
  );
}
