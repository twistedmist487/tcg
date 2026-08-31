import type { AppUser } from "@/lib/auth/use-current-user";
import { useArchive } from "@/lib/store";
import { loadArchive, saveArchive } from "./api";
import {
  agentIdFromUser,
  handleFromIdentity,
  isBurnerArchive,
  mergeArchives,
  toArchiveBlob,
  type ArchiveBlob,
} from "./blob";

function localBlob(): ArchiveBlob {
  return toArchiveBlob(useArchive.getState());
}

async function pushBlob(blob: ArchiveBlob) {
  await saveArchive({ data: { handle: blob.handle, archive: blob } });
}

function apply(blob: ArchiveBlob, userId: string) {
  useArchive.getState().applyCloudArchive(blob, userId);
}

export async function bindArchive(user: AppUser): Promise<"bound" | "skipped"> {
  const local = localBlob();
  const bound = useArchive.getState().cloudBoundUserId ?? null;

  let cloud: ArchiveBlob | null = null;
  try {
    const row = await loadArchive();
    cloud = row?.archive ?? null;
  } catch {
    return "skipped";
  }

  if (bound && bound !== user.id) {
    if (cloud) {
      apply(cloud, user.id);
      return "bound";
    }
    useArchive.getState().resetArchive();
    const fresh: ArchiveBlob = {
      ...toArchiveBlob(useArchive.getState()),
      handle: handleFromIdentity(user.displayName, user.id),
      agentId: agentIdFromUser(user.id),
    };
    apply(fresh, user.id);
    await pushBlob(fresh);
    return "bound";
  }

  if (!cloud) {
    let next = local;
    if (next.handle === "ARCHIVE_7") {
      next = {
        ...next,
        handle: handleFromIdentity(user.displayName, user.id),
        agentId: agentIdFromUser(user.id),
      };
    }
    apply(next, user.id);
    await pushBlob(next);
    return "bound";
  }

  if (isBurnerArchive(local) && !isBurnerArchive(cloud)) {
    apply(cloud, user.id);
    return "bound";
  }

  let merged = mergeArchives(local, cloud);
  if (merged.handle === "ARCHIVE_7") {
    merged = {
      ...merged,
      handle: handleFromIdentity(user.displayName, user.id),
      agentId: merged.agentId === 7 ? agentIdFromUser(user.id) : merged.agentId,
    };
  }
  apply(merged, user.id);
  await pushBlob(merged);
  return "bound";
}

export async function pushArchiveNow() {
  const state = useArchive.getState();
  if (!state.cloudBoundUserId) return;
  await pushBlob(toArchiveBlob(state));
}
