import { FACTION_META, type CardDef, type FactionId } from "@/lib/game/types";
import { keywordsOf, plateFor, rarityOf, rulesText } from "@/lib/game/catalog";
import { cn } from "@/lib/utils";

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

function artOffset(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return {
    x: 20 + (h % 55),
    y: 18 + ((h >> 6) % 50),
    src: ["/art/hero.jpg", "/art/cam-alley.jpg", "/art/cam-garage.jpg", "/art/eye.jpg"][h % 4]!,
  };
}

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
  const art = artOffset(card.id);
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
      <img src={plateFor(faction).back} alt="" className="h-full w-full object-cover" />
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
  onClick,
}: {
  name: string;
  atk: number;
  hp: number;
  exhausted?: boolean;
  taunt?: boolean;
  stealth?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex h-20 w-16 flex-col items-center justify-end overflow-hidden rounded-full bg-panel-2 text-center outline outline-1 transition-transform duration-150",
        taunt ? "outline-watch" : "outline-edge",
        selected && "outline-2 outline-phosphor",
        exhausted && "opacity-60",
        stealth && "opacity-80",
        onClick && "hover:-translate-y-1",
      )}
    >
      <span className="absolute inset-x-1 top-2 line-clamp-2 font-ui text-[9px] font-semibold leading-tight text-paper">
        {name}
      </span>
      <div className="mb-1 flex w-full justify-between px-1">
        <span className="rounded-sm bg-threat/80 px-1 font-mono text-[10px] text-paper">{atk}</span>
        <span className="rounded-sm bg-phosphor-deep px-1 font-mono text-[10px] text-phosphor">{hp}</span>
      </div>
    </Tag>
  );
}
