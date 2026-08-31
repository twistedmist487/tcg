import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useArchive } from "@/lib/store";
import { callsignOf, STARTER_LOADOUT } from "@/lib/game/cosmetics";

export function ClaimArchive() {
  const { user } = useCurrentUserState();
  const archive = useArchive();
  const loadout = archive.cosmeticsLoadout ?? STARTER_LOADOUT;
  const callsign = callsignOf(archive.handle, loadout.title);
  const bound = Boolean(user && archive.cloudBoundUserId === user.id);
  const [signingOut, setSigningOut] = useState(false);

  if (!authEnabled) return null;

  if (!user) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-void/50 p-3 outline outline-1 outline-edge">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.2em] text-watch">FILE STATUS · BURNER</div>
          <div className="font-ui text-lg font-semibold text-ink">{callsign}</div>
          <p className="mt-1 max-w-md font-mono text-[11px] leading-relaxed text-muted">
            Lives in this terminal. Bind it to Google or X and the collection walks with you.
          </p>
        </div>
        <Link
          to="/login"
          className="metal-btn-live inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-mono text-[10px] tracking-[0.16em] text-phosphor no-underline"
        >
          <Fingerprint className="size-3.5" />
          CLAIM ARCHIVE
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-void/50 p-3 outline outline-1 outline-edge">
      <div className="min-w-0">
        <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">
          FILE STATUS · {bound ? "BOUND" : "BINDING"}
        </div>
        <div className="font-ui text-lg font-semibold text-ink">{callsign}</div>
        <p className="mt-1 font-mono text-[11px] text-muted">
          Handler {user.displayName ?? user.primaryEmail ?? "UNKNOWN"} · agent {archive.agentId}
        </p>
      </div>
      <button
        type="button"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          void signOut("/locker").catch(() => setSigningOut(false));
        }}
        className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em] disabled:opacity-60"
      >
        {signingOut ? "DROPPING…" : "DROP FILE"}
      </button>
    </div>
  );
}
