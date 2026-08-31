import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons, PageHeader } from "@/components/nav/NavButtons";
import { CardFace } from "@/components/cards/CardFace";
import { collectibleCards } from "@/lib/game/catalog";
import { FACTION_META, type CardType, type FactionId } from "@/lib/game/types";
import { discoveredCount, ownedCopies, useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collection")({ component: CollectionPage });

const FACTIONS: Array<FactionId | "all"> = ["all", "illuminati", "templars", "reptilians", "neutral"];
const TYPES: Array<CardType | "all"> = ["all", "Character", "Spell", "Location"];

function CollectionPage() {
  const archive = useArchive();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [faction, setFaction] = useState<FactionId | "all">("all");
  const [type, setType] = useState<CardType | "all">("all");
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [fieldOnly, setFieldOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const field = new Set(archive.fieldAcquired ?? []);

  const cards = useMemo(() => {
    return collectibleCards().filter((c) => {
      if (faction !== "all" && c.faction !== faction) return false;
      if (type !== "all" && c.type !== type) return false;
      if (q && !`${c.name} ${c.ability ?? ""} ${c.effect ?? ""}`.toLowerCase().includes(q.toLowerCase())) {
        return false;
      }
      const n = ownedCopies(archive.collection, c.id);
      if (onlyOwned && n <= 0) return false;
      if (fieldOnly && !field.has(c.id)) return false;
      return true;
    });
  }, [q, faction, type, onlyOwned, fieldOnly, archive.collection, archive.fieldAcquired]);

  const found = discoveredCount(archive.collection);
  const selected = cards.find((c) => c.id === open);

  return (
    <TerminalFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel rounded-lg p-3">
            <NavButtons active="collection" />
          </div>
        </aside>
        <section className="panel min-h-0 flex-1 overflow-auto rounded-lg p-4 sm:p-6">
          <PageHeader
            kicker="// UNCOVER THE RECORD"
            title="Collection"
            action={
              <div className="flex items-center gap-2">
                <div className="font-mono text-[11px] tracking-[0.14em] text-phosphor">
                  {found} / {collectibleCards().length} FILES
                </div>
                <button
                  type="button"
                  className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em]"
                  onClick={() => void nav({ to: "/locker" })}
                >
                  LOCKER
                </button>
              </div>
            }
          />
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the record"
              className="min-h-11 min-w-48 flex-1 rounded-md bg-void px-3 font-mono text-sm outline outline-1 outline-edge focus:outline-phosphor"
            />
            {FACTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFaction(f)}
                className={cn(
                  "min-h-11 rounded-md px-3 font-mono text-[11px] uppercase tracking-widest",
                  faction === f ? "metal-btn-live text-phosphor" : "metal-btn",
                )}
              >
                {f === "all" ? "ALL" : FACTION_META[f].name.replace("The ", "")}
              </button>
            ))}
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "min-h-11 rounded-md px-3 font-mono text-[11px] uppercase tracking-widest",
                  type === t ? "metal-btn-live" : "metal-btn",
                )}
              >
                {t === "all" ? "ANY TYPE" : t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyOwned((v) => !v)}
              className={cn("min-h-11 rounded-md px-3 font-mono text-[11px]", onlyOwned ? "metal-btn-live" : "metal-btn")}
            >
              OWNED
            </button>
            <button
              type="button"
              onClick={() => setFieldOnly((v) => !v)}
              className={cn("min-h-11 rounded-md px-3 font-mono text-[11px]", fieldOnly ? "metal-btn-live" : "metal-btn")}
            >
              FIELD · {field.size}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {cards.map((c) => {
              const n = ownedCopies(archive.collection, c.id);
              return (
                <CardFace
                  key={c.id}
                  card={c}
                  copies={n}
                  locked={n <= 0}
                  compact
                  tag={field.has(c.id) ? "FIELD" : undefined}
                  onClick={() => setOpen(c.id)}
                />
              );
            })}
          </div>
        </section>
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-void/70 p-4 sm:items-center"
          role="dialog"
          onClick={() => setOpen(null)}
        >
          <div
            className="panel w-full max-w-md overflow-auto rounded-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <CardFace card={selected} copies={ownedCopies(archive.collection, selected.id)} />
            {field.has(selected.id) && (
              <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-gold">
                FIELD ACQUIRED — first-clear on The Inner Circle.
              </p>
            )}
            {selected.lore && (
              <p className="mt-3 font-mono text-[12px] italic leading-relaxed text-muted">{selected.lore}</p>
            )}
            <button
              type="button"
              className="metal-btn mt-4 min-h-11 w-full rounded-md font-mono text-[11px]"
              onClick={() => setOpen(null)}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </TerminalFrame>
  );
}
