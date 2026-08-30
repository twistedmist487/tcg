import { FACTION_META, type CardDef, type FactionId } from "@/lib/game/types";
import { artFor, keywordsOf, plateFor, rarityOf, rulesText } from "@/lib/game/catalog";
import { cn } from "@/lib/utils";
import type { PointerEvent } from "react";

const FACTION_TEXT: Record<FactionId, string> = {
  illuminati: "text-illuminati",
  templars: "text-templars",
  reptilians: "text-reptilians",
  neutral: "text-network",
};

const FACTION_RING: Record<FactionId, string> = {
  illuminati: "outline-illuminati/50",
  templars: "outline-templars/50",
  reptilians: "outline-reptilians/50",
  neutral: "outline-network/40",
};

export function CardFace({
  card,
  copies,
  locked,
  compact,
  onClick,
}: {
  card: CardDef;
  copies?: number;
  locked?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const art = artFor(card.id);
  const kws = keywordsOf(card);
  const rare = rarityOf(card);
  const Comp: "button" | "div" = onClick ? "button" : "div";

  return (
    <Comp
      {...(onClick ? { type: "button" as const } : {})}
      onClick={onClick}
      className={cn(
        "relative flex aspect-[5/7] w-full flex-col overflow-hidden rounded-md text-left outline outline-1 -outline-offset-1 transition-[transform,box-shadow] duration-150 ease-out",
        FACTION_RING[card.faction],
        onClick && "hover:-translate-y-1 hover:shadow-[0_12px_30px_rgb(0_0_0_/_0.5)] active:scale-[0.98]",
        locked && "grayscale",
      )}
    >
      <img
        src={plateFor(card.faction).front}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-void/40 via-transparent to-void/75" />
      <div className="relative z-10 flex h-full flex-col p-1.5 sm:p-2">
        <div className="flex items-start justify-between gap-1">
          <span className="flex size-7 items-center justify-center rounded-full bg-void/80 font-mono text-sm text-phosphor outline outline-1 outline-phosphor/40">
            {card.cost}
          </span>
          <span className={cn("font-mono text-[9px] uppercase tracking-widest", FACTION_TEXT[card.faction])}>
            {FACTION_META[card.faction].name.replace("The ", "")}
          </span>
        </div>
        <div className="relative mx-0.5 mt-1 min-h-0 flex-1 overflow-hidden rounded-sm outline outline-1 -outline-offset-1 outline-white/10">
          <img
            src={locked ? "/art/cam-garage.jpg" : art.src}
            alt=""
            className="h-full w-full scale-125 object-cover"
            style={{ objectPosition: `${art.x}% ${art.y}%` }}
            draggable={false}
          />
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-void/70 font-mono text-[10px] tracking-[0.2em] text-threat">
              [REDACTED]
            </div>
          )}
        </div>
        <div className="mt-1.5 px-0.5">
          <div className="font-ui text-[11px] font-semibold leading-tight text-paper text-balance sm:text-xs">
            {locked ? "CLASSIFIED FILE" : card.name}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
            {card.type} · {rare}
          </div>
        </div>
        {!compact && (
          <p className="mt-1 line-clamp-4 min-h-10 px-0.5 font-mono text-[9px] leading-snug text-ink/85">
            {locked ? "Clearance insufficient." : rulesText(card)}
          </p>
        )}
        {kws.length > 0 && !locked && (
          <div className="mt-1 flex flex-wrap gap-1 px-0.5">
            {kws.slice(0, 3).map((k) => (
              <span
                key={k}
                className="rounded-sm bg-phosphor-deep px-1 py-px font-mono text-[8px] uppercase tracking-wider text-phosphor"
              >
                {k}
              </span>
            ))}
          </div>
        )}
        {card.type === "Character" && (
          <div className="mt-auto flex items-end justify-between px-0.5 pt-1">
            <span className="flex size-6 items-center justify-center rounded-sm bg-threat/80 font-mono text-xs text-paper">
              {card.attack ?? 0}
            </span>
            <span className="flex size-6 items-center justify-center rounded-sm bg-phosphor-deep font-mono text-xs text-phosphor">
              {card.health ?? 0}
            </span>
          </div>
        )}
        {copies != null && copies > 0 && (
          <span className="absolute right-1 bottom-1 rounded-sm bg-void/80 px-1 font-mono text-[9px] text-phosphor">
            ×{copies}
          </span>
        )}
      </div>
    </Comp>
  );
}

export function CardBack({ faction, className }: { faction: FactionId; className?: string }) {
  return (
    <div
      className={cn(
        "aspect-[5/7] overflow-hidden rounded-md outline outline-1 -outline-offset-1 outline-white/10",
        className,
      )}
    >
      <img src={plateFor(faction).back} alt="" className="h-full w-full object-cover" draggable={false} />
    </div>
  );
}

export function MiniMinion({
  name,
  atk,
  hp,
  exhausted,
  taunt,
  stealth,
  selected,
  targetable,
  ready,
  coached,
  cardId,
  iid,
  faction,
  onClick,
  onPointerDown,
}: {
  name: string;
  atk: number;
  hp: number;
  exhausted?: boolean;
  taunt?: boolean;
  stealth?: boolean;
  selected?: boolean;
  targetable?: boolean;
  ready?: boolean;
  coached?: boolean;
  cardId?: string;
  iid?: string;
  faction?: FactionId;
  onClick?: () => void;
  onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
}) {
  const art = artFor(cardId ?? name);
  return (
    <button
      type="button"
      data-iid={iid}
      data-card-name={name}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "minion-unit",
        faction,
        exhausted && "is-exhausted",
        selected && "is-selected",
        targetable && "is-targetable",
        stealth && "is-stealth",
        taunt && "is-taunt",
        ready && "is-ready",
        coached && "coach-mark",
      )}
    >
      <span className="minion-art">
        <img
          src={art.src}
          alt=""
          style={{ objectPosition: `${art.x}% ${art.y}%` }}
          draggable={false}
        />
        {stealth && <span className="minion-stealth" />}
      </span>
      <span className="minion-name">{name}</span>
      <span className="minion-atk">{atk}</span>
      <span className="minion-hp">{hp}</span>
    </button>
  );
}
