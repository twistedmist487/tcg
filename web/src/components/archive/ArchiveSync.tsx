import { useEffect, useRef, useState } from "react";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bindArchive, pushArchiveNow } from "@/lib/archive/sync";
import { toArchiveBlob } from "@/lib/archive/blob";
import { useArchive } from "@/lib/store";

export function ArchiveSync() {
  const { user, isPending } = useCurrentUserState();
  const [hydrated, setHydrated] = useState(false);
  const applying = useRef(false);
  const boundFor = useRef<string | null>(null);
  const lastKey = useRef<string>("");

  useEffect(() => {
    const api = useArchive.persist;
    const mark = () => setHydrated(true);
    if (typeof api?.hasHydrated === "function" && api.hasHydrated()) {
      mark();
      return;
    }
    const unsub = typeof api?.onFinishHydration === "function" ? api.onFinishHydration(mark) : undefined;
    const fallback = window.setTimeout(mark, 50);
    return () => {
      window.clearTimeout(fallback);
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    if (!authEnabled) return;
    if (isPending || !hydrated) return;
    if (!user) {
      boundFor.current = null;
      return;
    }
    if (boundFor.current === user.id) return;
    boundFor.current = user.id;
    applying.current = true;
    void bindArchive(user)
      .catch(() => {
        boundFor.current = null;
      })
      .finally(() => {
        lastKey.current = JSON.stringify(toArchiveBlob(useArchive.getState()));
        applying.current = false;
      });
  }, [user, isPending, hydrated]);

  useEffect(() => {
    if (!authEnabled || !user) return;
    let timer: number | undefined;
    const unsub = useArchive.subscribe(() => {
      if (applying.current) return;
      const state = useArchive.getState();
      if (!state.cloudBoundUserId) return;
      const key = JSON.stringify(toArchiveBlob(state));
      if (key === lastKey.current) return;
      lastKey.current = key;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void pushArchiveNow().catch(() => {
          /* keep local; next mutation retries */
        });
      }, 900);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [user]);

  return null;
}
