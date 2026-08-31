import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (user) return <Navigate to="/locker" />;

  return (
    <TerminalFrame>
      <section className="panel relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center overflow-auto rounded-lg p-5 sm:p-8">
        <div className="font-mono text-[10px] tracking-[0.22em] text-phosphor">// BIND FILE TO HANDLER</div>
        <h1 className="mt-1 font-display text-3xl tracking-wide text-ink">CLAIM ARCHIVE</h1>
        <p className="mt-3 max-w-md font-mono text-[12px] leading-relaxed text-muted">
          Burner files die with the browser. Bind to Google or X and the collection, cosmetics, and campaign walk with
          you. Play still works unsigned.
        </p>

        <div className="mt-6 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                disabled={Boolean(pending) || isPending}
                onClick={() => {
                  setPending(p.providerId);
                  setErr(null);
                  void signIn(p.providerId, { callbackURL: "/locker", errorCallbackURL: "/login" }).catch((e) => {
                    setErr(e instanceof Error ? e.message : "Bind failed");
                    setPending(null);
                  });
                }}
                className="metal-btn-live flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 font-ui text-sm font-semibold tracking-[0.18em] text-phosphor disabled:opacity-60"
              >
                <Fingerprint className="size-4" />
                {pending === p.providerId ? "OPENING CHANNEL…" : `CONTINUE WITH ${p.label.toUpperCase()}`}
              </button>
            ))
          ) : (
            <p className="font-mono text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>

        {err ? <p className="mt-3 font-mono text-[12px] text-threat">{err}</p> : null}

        <Link
          to="/"
          className="mt-6 font-mono text-[11px] tracking-[0.16em] text-muted no-underline hover:text-phosphor"
        >
          STILL A BURNER · PLAY ANYWAY
        </Link>
      </section>
    </TerminalFrame>
  );
}
