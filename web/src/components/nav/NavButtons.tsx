import { Link } from "@tanstack/react-router";
import { Crosshair, Eye, FolderClosed, Layers, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NAV } from "@/components/nav/items";

const ICONS = {
  play: Eye,
  decks: Layers,
  collection: FolderClosed,
  missions: Crosshair,
  store: ShoppingCart,
} as const;

export function NavButtons({
  active,
  stacked = true,
}: {
  active?: string;
  stacked?: boolean;
}) {
  return (
    <nav className={cn("flex gap-2", stacked ? "flex-col" : "flex-row overflow-x-auto")}>
      {NAV.map((item) => {
        const Icon = ICONS[item.id];
        const live = active === item.id;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 no-underline transition-transform duration-150 ease-out active:scale-[0.98]",
              stacked ? "w-full" : "min-w-40 shrink-0",
              live ? "metal-btn-live" : "metal-btn hover:brightness-110",
            )}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-sm border",
                live
                  ? "border-phosphor/50 bg-phosphor-deep text-phosphor"
                  : "border-edge bg-void text-muted group-hover:text-ink",
              )}
            >
              <Icon className="size-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 text-left">
              <span
                className={cn(
                  "block font-ui text-lg font-semibold leading-none tracking-[0.14em]",
                  live ? "text-phosphor" : "text-ink",
                )}
              >
                {item.label}
              </span>
              <span className="mt-1 block font-mono text-[10px] tracking-[0.16em] text-muted">
                {item.sub}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] text-phosphor">{kicker}</div>
        <h1 className="font-display text-2xl tracking-wide text-ink text-balance sm:text-3xl">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
