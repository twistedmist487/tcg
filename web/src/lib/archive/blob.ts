import { STARTER_LOADOUT, type CosmeticLoadout } from "@/lib/game/cosmetics";
import type { CampaignRun, DeckList } from "@/lib/game/types";

export const ARCHIVE_SCHEMA_VER = 1 as const;

export type MissionStatus = "locked" | "available" | "complete";

export type ArchiveBlob = {
  schemaVer: typeof ARCHIVE_SCHEMA_VER;
  agentId: number;
  handle: string;
  level: number;
  xp: number;
  credits: number;
  decrypted: boolean;
  collection: Record<string, number>;
  decks: DeckList[];
  activeDeckId: string;
  missions: Record<string, MissionStatus>;
  wins: number;
  losses: number;
  packsOpened: number;
  cosmeticsUnlocked: string[];
  cosmeticsLoadout: CosmeticLoadout;
  fieldAcquired: string[];
  cityCleared: boolean;
  chapterCleared: boolean;
  heroicCleared: boolean;
  recklessCleared: boolean;
  vaultCleared: boolean;
  vaultHeroicCleared: boolean;
  vaultRecklessCleared: boolean;
  hiveCleared: boolean;
  hiveHeroicCleared: boolean;
  hiveRecklessCleared: boolean;
  cryptCleared: boolean;
  cryptHeroicCleared: boolean;
  nestCleared: boolean;
  nestHeroicCleared: boolean;
  circleCleared: boolean;
  campaignRun: CampaignRun | null;
};

const FLAG_KEYS = [
  "cityCleared",
  "chapterCleared",
  "heroicCleared",
  "recklessCleared",
  "vaultCleared",
  "vaultHeroicCleared",
  "vaultRecklessCleared",
  "hiveCleared",
  "hiveHeroicCleared",
  "hiveRecklessCleared",
  "cryptCleared",
  "cryptHeroicCleared",
  "nestCleared",
  "nestHeroicCleared",
  "circleCleared",
] as const;

function num(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown) {
  return Boolean(v);
}

function str(v: unknown, fallback: string) {
  return typeof v === "string" ? v : fallback;
}

function collectionOf(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(v as Record<string, unknown>)) {
    const copies = typeof n === "number" && n > 0 ? Math.floor(n) : 0;
    out[id] = copies;
  }
  return out;
}

function decksOf(v: unknown): DeckList[] {
  if (!Array.isArray(v)) return [];
  return v.filter((d): d is DeckList => Boolean(d && typeof d === "object" && typeof (d as DeckList).id === "string"));
}

function missionsOf(v: unknown): Record<string, MissionStatus> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, MissionStatus> = {};
  for (const [id, status] of Object.entries(v as Record<string, unknown>)) {
    if (status === "locked" || status === "available" || status === "complete") out[id] = status;
  }
  return out;
}

function loadoutOf(v: unknown): CosmeticLoadout {
  if (!v || typeof v !== "object") return { ...STARTER_LOADOUT };
  const o = v as Partial<CosmeticLoadout>;
  return {
    cardBack: str(o.cardBack, STARTER_LOADOUT.cardBack),
    tableFelt: str(o.tableFelt, STARTER_LOADOUT.tableFelt),
    nameplate: str(o.nameplate, STARTER_LOADOUT.nameplate),
    title: str(o.title, STARTER_LOADOUT.title),
  };
}

function stringsOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function toArchiveBlob(raw: unknown): ArchiveBlob {
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return {};
          }
        })()
      : raw;
  const s = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const campaignRun =
    s.campaignRun && typeof s.campaignRun === "object" ? (s.campaignRun as CampaignRun) : null;
  return {
    schemaVer: ARCHIVE_SCHEMA_VER,
    agentId: num(s.agentId, 7),
    handle: str(s.handle, "ARCHIVE_7").slice(0, 24),
    level: num(s.level, 1),
    xp: num(s.xp, 0),
    credits: num(s.credits, 0),
    decrypted: bool(s.decrypted),
    collection: collectionOf(s.collection),
    decks: decksOf(s.decks),
    activeDeckId: str(s.activeDeckId, "templars"),
    missions: missionsOf(s.missions),
    wins: num(s.wins, 0),
    losses: num(s.losses, 0),
    packsOpened: num(s.packsOpened, 0),
    cosmeticsUnlocked: stringsOf(s.cosmeticsUnlocked),
    cosmeticsLoadout: loadoutOf(s.cosmeticsLoadout),
    fieldAcquired: stringsOf(s.fieldAcquired),
    cityCleared: bool(s.cityCleared),
    chapterCleared: bool(s.chapterCleared),
    heroicCleared: bool(s.heroicCleared),
    recklessCleared: bool(s.recklessCleared),
    vaultCleared: bool(s.vaultCleared),
    vaultHeroicCleared: bool(s.vaultHeroicCleared),
    vaultRecklessCleared: bool(s.vaultRecklessCleared),
    hiveCleared: bool(s.hiveCleared),
    hiveHeroicCleared: bool(s.hiveHeroicCleared),
    hiveRecklessCleared: bool(s.hiveRecklessCleared),
    cryptCleared: bool(s.cryptCleared),
    cryptHeroicCleared: bool(s.cryptHeroicCleared),
    nestCleared: bool(s.nestCleared),
    nestHeroicCleared: bool(s.nestHeroicCleared),
    circleCleared: bool(s.circleCleared),
    campaignRun,
  };
}

export function isBurnerArchive(blob: ArchiveBlob): boolean {
  if (blob.campaignRun) return false;
  if (blob.wins > 0 || blob.packsOpened > 0 || blob.fieldAcquired.length > 0) return false;
  return FLAG_KEYS.every((k) => !blob[k]);
}

const MISSION_RANK: Record<MissionStatus, number> = { locked: 0, available: 1, complete: 2 };

function mergeMissions(
  a: Record<string, MissionStatus>,
  b: Record<string, MissionStatus>,
): Record<string, MissionStatus> {
  const out: Record<string, MissionStatus> = { ...a };
  for (const [id, status] of Object.entries(b)) {
    const cur = out[id];
    if (!cur || MISSION_RANK[status] > MISSION_RANK[cur]) out[id] = status;
  }
  return out;
}

function mergeCollection(a: Record<string, number>, b: Record<string, number>) {
  const out: Record<string, number> = { ...a };
  for (const [id, n] of Object.entries(b)) out[id] = Math.max(out[id] ?? 0, n);
  return out;
}

function chapterRank(id: string | undefined) {
  if (id === "circle") return 4;
  if (id === "reptilians") return 3;
  if (id === "templars") return 2;
  if (id === "illuminati") return 1;
  return 0;
}

function runWeight(run: CampaignRun) {
  return run.cleared.length + (run.reverseCleared?.length ?? 0) + run.ledger.length;
}

function mergeRun(local: CampaignRun | null, cloud: CampaignRun | null): CampaignRun | null {
  if (!local) return cloud;
  if (!cloud) return local;
  if (local.chapterId === cloud.chapterId && local.boardId === cloud.boardId) {
    return runWeight(local) >= runWeight(cloud) ? local : cloud;
  }
  return chapterRank(local.chapterId) >= chapterRank(cloud.chapterId) ? local : cloud;
}

function mergeDecks(local: DeckList[], cloud: DeckList[]): DeckList[] {
  const byId = new Map<string, DeckList>();
  for (const d of cloud) byId.set(d.id, d);
  for (const d of local) byId.set(d.id, d);
  return [...byId.values()];
}

export function mergeArchives(local: ArchiveBlob, cloud: ArchiveBlob): ArchiveBlob {
  const xp = Math.max(local.xp, cloud.xp);
  return {
    schemaVer: ARCHIVE_SCHEMA_VER,
    agentId: local.handle === "ARCHIVE_7" ? cloud.agentId : local.agentId,
    handle: local.handle === "ARCHIVE_7" ? cloud.handle : local.handle,
    xp,
    level: Math.max(local.level, cloud.level, 1 + Math.floor(xp / 400)),
    credits: Math.max(local.credits, cloud.credits),
    decrypted: local.decrypted || cloud.decrypted,
    collection: mergeCollection(local.collection, cloud.collection),
    decks: mergeDecks(local.decks, cloud.decks),
    activeDeckId: local.activeDeckId,
    missions: mergeMissions(cloud.missions, local.missions),
    wins: Math.max(local.wins, cloud.wins),
    losses: Math.max(local.losses, cloud.losses),
    packsOpened: Math.max(local.packsOpened, cloud.packsOpened),
    cosmeticsUnlocked: [...new Set([...cloud.cosmeticsUnlocked, ...local.cosmeticsUnlocked])],
    cosmeticsLoadout: local.cosmeticsLoadout,
    fieldAcquired: [...new Set([...cloud.fieldAcquired, ...local.fieldAcquired])],
    cityCleared: local.cityCleared || cloud.cityCleared,
    chapterCleared: local.chapterCleared || cloud.chapterCleared,
    heroicCleared: local.heroicCleared || cloud.heroicCleared,
    recklessCleared: local.recklessCleared || cloud.recklessCleared,
    vaultCleared: local.vaultCleared || cloud.vaultCleared,
    vaultHeroicCleared: local.vaultHeroicCleared || cloud.vaultHeroicCleared,
    vaultRecklessCleared: local.vaultRecklessCleared || cloud.vaultRecklessCleared,
    hiveCleared: local.hiveCleared || cloud.hiveCleared,
    hiveHeroicCleared: local.hiveHeroicCleared || cloud.hiveHeroicCleared,
    hiveRecklessCleared: local.hiveRecklessCleared || cloud.hiveRecklessCleared,
    cryptCleared: local.cryptCleared || cloud.cryptCleared,
    cryptHeroicCleared: local.cryptHeroicCleared || cloud.cryptHeroicCleared,
    nestCleared: local.nestCleared || cloud.nestCleared,
    nestHeroicCleared: local.nestHeroicCleared || cloud.nestHeroicCleared,
    circleCleared: local.circleCleared || cloud.circleCleared,
    campaignRun: mergeRun(local.campaignRun, cloud.campaignRun),
  };
}

export function handleFromIdentity(name: string | null | undefined, userId: string): string {
  const raw = (name ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 16);
  if (raw.length >= 3) return raw;
  const tail = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0007";
  return `ARCHIVE_${tail}`;
}

export function agentIdFromUser(userId: string): number {
  let n = 0;
  for (let i = 0; i < userId.length; i++) n = (n * 33 + userId.charCodeAt(i)) >>> 0;
  return (n % 9000) + 1000;
}
