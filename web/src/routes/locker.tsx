import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons, PageHeader } from "@/components/nav/NavButtons";
import { ClaimArchive } from "@/components/archive/ClaimArchive";
import {
  COSMETICS,
  SLOT_LABEL,
  STARTER_LOADOUT,
  callsignOf,
  cosmeticById,
  cosmeticsForSlot,
  isCosmeticUnlocked,
  type Cosmetic,
  type CosmeticSlot,
} from "@/lib/game/cosmetics";
import { archiveProgress, useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/locker")({ component: LockerPage });

const SLOTS: CosmeticSlot[] = ["title", "cardBack", "tableFelt", "nameplate"];

function LockerPage() {
  const archive = useArchive();
  const nav = useNavigate();
  const loadout = archive.cosmeticsLoadout ?? STARTER_LOADOUT;
  const progress = archiveProgress(archive);
  const callsign = callsignOf(archive.handle, loadout.title);
  const sleeve = cosmeticById(loadout.cardBack);
  const felt = cosmeticById(loadout.tableFelt);

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
            kicker="// EQUIP THE RECORD"
            title="Locker"
            action={
              <button
                type="button"
                className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em]"
                onClick={() => void nav({ to: "/campaign" })}
              >
                INVESTIGATION
              </button>
            }
          />
          <p className="max-w-xl font-mono text-[12px] leading-relaxed text-muted">
            Sleeves, plates, and callsigns earned in the field. Equip them before you walk a node. Heroic and
            Reckless have their own stock.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-md bg-void/50 p-3 outline outline-1 outline-edge">
            {sleeve?.src ? (
              <img
                src={sleeve.src}
                alt=""
                className="h-20 w-14 rounded-sm object-cover outline outline-1 outline-edge"
              />
            ) : null}
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-gold">ON TABLE</div>
              <div className="font-ui text-xl font-semibold text-ink">{callsign}</div>
              <div className="font-mono text-[11px] text-muted">
                {sleeve?.name} · {felt?.name}
              </div>
            </div>
          </div>

          <ClaimArchive />

          {SLOTS.map((slot) => (
            <section key={slot} className="mt-8">
              <h2 className="font-mono text-[10px] tracking-[0.22em] text-phosphor">{SLOT_LABEL[slot]}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {cosmeticsForSlot(slot).map((item) => (
                  <LockerTile
                    key={item.id}
                    item={item}
                    equipped={loadout[slot] === item.id}
                    unlocked={
                      isCosmeticUnlocked(item, progress) ||
                      (archive.cosmeticsUnlocked ?? []).includes(item.id)
                    }
                    onEquip={() => archive.equipCosmetic(item.id)}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="mt-8 font-mono text-[11px] text-muted">
            {COSMETICS.filter((c) => isCosmeticUnlocked(c, progress)).length} / {COSMETICS.length} on file.
          </p>
        </section>
      </div>
    </TerminalFrame>
  );
}

function LockerTile({
  item,
  equipped,
  unlocked,
  onEquip,
}: {
  item: Cosmetic;
  equipped: boolean;
  unlocked: boolean;
  onEquip: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onEquip}
      className={cn(
        "rounded-lg p-3 text-left",
        equipped ? "metal-btn-live" : "metal-btn",
        !unlocked && "opacity-60",
      )}
    >
      {item.src ? (
        <img
          src={item.src}
          alt=""
          className={cn(
            "mb-2 h-24 w-full rounded-sm object-cover outline outline-1 outline-edge",
            item.slot === "cardBack" && "mx-auto h-28 w-20",
            !unlocked && "grayscale",
          )}
        />
      ) : (
        <div className="mb-2 flex h-16 items-center justify-center rounded-sm bg-void font-display text-sm tracking-wide text-gold">
          {item.name}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-ui text-sm font-semibold text-ink">{item.name}</span>
        {!unlocked && <Lock className="size-3.5 shrink-0 text-muted" />}
      </div>
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted">
        {unlocked ? item.blurb : item.hint}
      </p>
      <div className="mt-2 font-mono text-[10px] tracking-[0.16em] text-watch">
        {equipped ? "EQUIPPED" : unlocked ? "EQUIP" : "SEALED"}
      </div>
    </button>
  );
}
