import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CURATED_DECKS,
  STARTER_UNLOCKS,
  collectibleCards,
  getCard,
} from "@/lib/game/catalog";
import {
  NODE_FIRST_CLEAR,
  applyNodeClear,
  applySafehousePick,
  enterHq,
  enterCrypt,
  enterNest,
  getBoard,
  getNode,
  rewardKey,
} from "@/lib/game/campaign";
import {
  STARTER_LOADOUT,
  cosmeticById,
  unlocksFromProgress,
  type CosmeticLoadout,
  type CosmeticProgress,
  type CosmeticSlot,
} from "@/lib/game/cosmetics";
import type { CampaignRun, DeckList, MatchState, SafehousePick } from "@/lib/game/types";
import { toArchiveBlob, type ArchiveBlob } from "@/lib/archive/blob";

type Collection = Record<string, number>;

type MissionStatus = "locked" | "available" | "complete";

type AgentState = {
  agentId: number;
  handle: string;
  level: number;
  xp: number;
  credits: number;
  decrypted: boolean;
  collection: Collection;
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
  cloudBoundUserId: string | null;
};

type Store = AgentState & {
  match: MatchState | null;
  campaignRun: CampaignRun | null;
  setMatch: (m: MatchState | null) => void;
  setCampaignRun: (run: CampaignRun | null) => void;
  addXp: (n: number) => void;
  addCredits: (n: number) => void;
  decrypt: () => void;
  grantCard: (id: string, n?: number) => void;
  saveDeck: (deck: DeckList) => void;
  deleteDeck: (id: string) => void;
  setActiveDeck: (id: string) => void;
  completeMission: (id: string) => void;
  recordMatch: (won: boolean) => void;
  completeCampaignNode: (nodeId: string) => void;
  applyCampaignSafehouse: (nodeId: string, pick: SafehousePick) => void;
  enterCampaignHq: () => void;
  enterCampaignCrypt: () => void;
  enterCampaignNest: () => void;
  equipCosmetic: (id: string) => void;
  applyCloudArchive: (blob: ArchiveBlob, userId: string) => void;
  resetArchive: () => void;
};

const STARTER_MISSIONS: Record<string, MissionStatus> = {
  tutorial: "available",
  keyword_lab: "available",
  showcase_illuminati: "available",
  showcase_templars: "available",
  showcase_reptilians: "available",
  illuminati: "available",
  templars: "locked",
  reptilians: "locked",
  challenge_black_room: "locked",
  challenge_street_war: "locked",
  challenge_unquiet: "locked",
  circle: "locked",
};

function starterCollection(): Collection {
  const c: Collection = {};
  for (const id of STARTER_UNLOCKS) c[id] = Math.max(c[id] ?? 0, 2);
  for (const card of collectibleCards()) {
    if (c[card.id] == null) c[card.id] = 0;
  }
  return c;
}

function starterDecks(): DeckList[] {
  return CURATED_DECKS.map((d) => ({ ...d, custom: false }));
}

function progressOf(s: Pick<AgentState, "cityCleared" | "chapterCleared" | "heroicCleared" | "recklessCleared" | "vaultCleared" | "vaultHeroicCleared" | "vaultRecklessCleared" | "hiveCleared" | "hiveHeroicCleared" | "hiveRecklessCleared" | "cryptCleared" | "cryptHeroicCleared" | "nestCleared" | "nestHeroicCleared" | "circleCleared">): CosmeticProgress {
  return {
    cityCleared: Boolean(s.cityCleared),
    chapterCleared: Boolean(s.chapterCleared),
    heroicCleared: Boolean(s.heroicCleared),
    recklessCleared: Boolean(s.recklessCleared),
    vaultCleared: Boolean(s.vaultCleared),
    vaultHeroicCleared: Boolean(s.vaultHeroicCleared),
    vaultRecklessCleared: Boolean(s.vaultRecklessCleared),
    hiveCleared: Boolean(s.hiveCleared),
    hiveHeroicCleared: Boolean(s.hiveHeroicCleared),
    hiveRecklessCleared: Boolean(s.hiveRecklessCleared),
    cryptCleared: Boolean(s.cryptCleared),
    cryptHeroicCleared: Boolean(s.cryptHeroicCleared),
    nestCleared: Boolean(s.nestCleared),
    nestHeroicCleared: Boolean(s.nestHeroicCleared),
    circleCleared: Boolean(s.circleCleared),
  };
}

function mergeUnlocks(s: AgentState, extra: CosmeticProgress): string[] {
  const ids = unlocksFromProgress({
    cityCleared: s.cityCleared || extra.cityCleared,
    chapterCleared: s.chapterCleared || extra.chapterCleared,
    heroicCleared: s.heroicCleared || extra.heroicCleared,
    recklessCleared: s.recklessCleared || extra.recklessCleared,
    vaultCleared: s.vaultCleared || extra.vaultCleared,
    vaultHeroicCleared: s.vaultHeroicCleared || extra.vaultHeroicCleared,
    vaultRecklessCleared: s.vaultRecklessCleared || extra.vaultRecklessCleared,
    hiveCleared: s.hiveCleared || extra.hiveCleared,
    hiveHeroicCleared: s.hiveHeroicCleared || extra.hiveHeroicCleared,
    hiveRecklessCleared: s.hiveRecklessCleared || extra.hiveRecklessCleared,
    cryptCleared: s.cryptCleared || extra.cryptCleared,
    cryptHeroicCleared: s.cryptHeroicCleared || extra.cryptHeroicCleared,
    nestCleared: s.nestCleared || extra.nestCleared,
    nestHeroicCleared: s.nestHeroicCleared || extra.nestHeroicCleared,
    circleCleared: s.circleCleared || extra.circleCleared,
  });
  return [...new Set([...s.cosmeticsUnlocked, ...ids])];
}

const initial = (): AgentState => ({
  agentId: 7,
  handle: "ARCHIVE_7",
  level: 42,
  xp: 13370,
  credits: 420,
  decrypted: false,
  collection: starterCollection(),
  decks: starterDecks(),
  activeDeckId: "templars",
  missions: { ...STARTER_MISSIONS },
  wins: 0,
  losses: 0,
  packsOpened: 0,
  cosmeticsUnlocked: unlocksFromProgress({
    cityCleared: false,
    chapterCleared: false,
    heroicCleared: false,
    recklessCleared: false,
    vaultCleared: false,
    vaultHeroicCleared: false,
    vaultRecklessCleared: false,
    hiveCleared: false,
    hiveHeroicCleared: false,
    hiveRecklessCleared: false,
    cryptCleared: false,
    cryptHeroicCleared: false,
    nestCleared: false,
    nestHeroicCleared: false,
    circleCleared: false,
  }),
  cosmeticsLoadout: { ...STARTER_LOADOUT },
  fieldAcquired: [],
  cityCleared: false,
  chapterCleared: false,
  heroicCleared: false,
  recklessCleared: false,
  vaultCleared: false,
  vaultHeroicCleared: false,
  vaultRecklessCleared: false,
  hiveCleared: false,
  hiveHeroicCleared: false,
  hiveRecklessCleared: false,
  cryptCleared: false,
  cryptHeroicCleared: false,
  nestCleared: false,
  nestHeroicCleared: false,
  circleCleared: false,
  cloudBoundUserId: null,
});

export const useArchive = create<Store>()(
  persist(
    (set, get) => ({
      ...initial(),
      match: null,
      campaignRun: null,
      setMatch: (m) => set({ match: m }),
      setCampaignRun: (run) => set({ campaignRun: run }),
      addXp: (n) =>
        set((s) => {
          const xp = s.xp + n;
          const level = Math.max(s.level, 1 + Math.floor(xp / 400));
          return { xp, level };
        }),
      addCredits: (n) => set((s) => ({ credits: Math.max(0, s.credits + n) })),
      decrypt: () => set({ decrypted: true }),
      grantCard: (id, n = 1) => {
        if (!getCard(id)) return;
        set((s) => ({
          collection: { ...s.collection, [id]: (s.collection[id] ?? 0) + n },
        }));
      },
      saveDeck: (deck) =>
        set((s) => {
          const i = s.decks.findIndex((d) => d.id === deck.id);
          const decks = [...s.decks];
          if (i >= 0) decks[i] = deck;
          else decks.push(deck);
          return { decks, activeDeckId: deck.id };
        }),
      deleteDeck: (id) =>
        set((s) => ({
          decks: s.decks.filter((d) => d.id !== id || !d.custom),
          activeDeckId: s.activeDeckId === id ? "templars" : s.activeDeckId,
        })),
      setActiveDeck: (id) => set({ activeDeckId: id }),
      completeMission: (id) =>
        set((s) => {
          const missions = { ...s.missions, [id]: "complete" as const };
          if (s.wins + 1 >= 1) missions.challenge_black_room = missions.challenge_black_room === "locked" ? "available" : missions.challenge_black_room;
          if ((s.wins >= 1 || id.startsWith("showcase") || id === "tutorial") && missions.challenge_street_war === "locked") {
            missions.challenge_street_war = "available";
          }
          if (missions.challenge_black_room === "complete" || id === "challenge_black_room") {
            missions.challenge_unquiet = missions.challenge_unquiet === "locked" ? "available" : missions.challenge_unquiet;
          }
          return { missions };
        }),
      recordMatch: (won) =>
        set((s) => ({
          wins: s.wins + (won ? 1 : 0),
          losses: s.losses + (won ? 0 : 1),
        })),
      completeCampaignNode: (nodeId) =>
        set((s) => {
          const run = s.campaignRun;
          if (!run) return {};
          const board = getBoard(run.chapterId, run.boardId);
          const node = board ? getNode(board, nodeId) : undefined;
          if (!node || !board) return {};
          const key = rewardKey(run, nodeId);
          const already = run.rewardsGranted.includes(key);
          const nextRun = applyNodeClear(run, node, board);
          nextRun.rewardsGranted = already ? run.rewardsGranted : [...run.rewardsGranted, key];
          let credits = s.credits;
          const collection = { ...s.collection };
          const fieldAcquired = [...s.fieldAcquired];
          if (!already) {
            const rw = NODE_FIRST_CLEAR[key] ?? NODE_FIRST_CLEAR[nodeId] ?? { credits: 0, cards: [] };
            credits += rw.credits;
            for (const id of rw.cards) {
              if (!getCard(id)) continue;
              collection[id] = (collection[id] ?? 0) + 1;
              if (!fieldAcquired.includes(id)) fieldAcquired.push(id);
            }
          }
          const cityCleared = s.cityCleared || Boolean(nextRun.flags.board_city_complete);
          const chapterCleared = s.chapterCleared || Boolean(nextRun.flags.illuminati_chapter_complete);
          const heroicCleared =
            s.heroicCleared || (Boolean(nextRun.flags.illuminati_chapter_complete) && run.difficulty === "heroic");
          const recklessCleared =
            s.recklessCleared ||
            (Boolean(nextRun.flags.illuminati_chapter_complete) && Boolean(nextRun.flags.skipped_safe_drop));
          const vaultCleared = s.vaultCleared || Boolean(nextRun.flags.board_vault_complete) || Boolean(nextRun.flags.templars_chapter_complete && nextRun.boardId !== "crypt");
          const vaultHeroicCleared =
            s.vaultHeroicCleared ||
            ((Boolean(nextRun.flags.board_vault_complete) || Boolean(nextRun.flags.templars_chapter_complete)) && run.difficulty === "heroic" && run.boardId !== "crypt");
          const vaultRecklessCleared =
            s.vaultRecklessCleared ||
            (Boolean(nextRun.flags.templars_chapter_complete) && Boolean(nextRun.flags.skipped_vestry));
          const hiveCleared = s.hiveCleared || Boolean(nextRun.flags.board_hive_complete) || Boolean(nextRun.flags.reptilians_chapter_complete && nextRun.boardId !== "nest");
          const hiveHeroicCleared =
            s.hiveHeroicCleared ||
            ((Boolean(nextRun.flags.board_hive_complete) || Boolean(nextRun.flags.reptilians_chapter_complete)) && run.difficulty === "heroic" && run.boardId !== "nest");
          const hiveRecklessCleared =
            s.hiveRecklessCleared ||
            (Boolean(nextRun.flags.reptilians_chapter_complete) && Boolean(nextRun.flags.skipped_molt));
          const cryptCleared = s.cryptCleared || Boolean(nextRun.flags.board_crypt_complete);
          const cryptHeroicCleared =
            s.cryptHeroicCleared ||
            (Boolean(nextRun.flags.board_crypt_complete) && run.difficulty === "heroic");
          const nestCleared = s.nestCleared || Boolean(nextRun.flags.board_nest_complete);
          const nestHeroicCleared =
            s.nestHeroicCleared ||
            (Boolean(nextRun.flags.board_nest_complete) && run.difficulty === "heroic");
          const circleCleared = s.circleCleared || Boolean(nextRun.flags.circle_chapter_complete) || Boolean(nextRun.flags.board_circle_complete);
          if (!s.heroicCleared && heroicCleared) credits += 150;
          if (!s.vaultHeroicCleared && vaultHeroicCleared) credits += 150;
          if (!s.hiveHeroicCleared && hiveHeroicCleared) credits += 150;
          if (!s.cryptHeroicCleared && cryptHeroicCleared) credits += 150;
          if (!s.nestHeroicCleared && nestHeroicCleared) credits += 150;
          const cosmeticsUnlocked = mergeUnlocks(s, {
            cityCleared,
            chapterCleared,
            heroicCleared,
            recklessCleared,
            vaultCleared,
            vaultHeroicCleared,
            vaultRecklessCleared,
            hiveCleared,
            hiveHeroicCleared,
            hiveRecklessCleared,
            cryptCleared,
            cryptHeroicCleared,
            nestCleared,
            nestHeroicCleared,
            circleCleared,
          });
          const missions = { ...s.missions };
          if (nextRun.flags.board_city_complete) missions.illuminati = "complete";
          if (nextRun.flags.illuminati_chapter_complete) {
            missions.illuminati = "complete";
            if (missions.templars === "locked") missions.templars = "available";
          }
          if (nextRun.flags.templars_chapter_complete) {
            missions.templars = "complete";
            if (missions.reptilians === "locked") missions.reptilians = "available";
          }
          if (nextRun.flags.board_vault_complete && missions.templars === "locked") missions.templars = "available";
          if (nextRun.flags.board_hive_complete && missions.reptilians === "locked") missions.reptilians = "available";
          if (nextRun.flags.reptilians_chapter_complete) missions.reptilians = "complete";
          if (chapterCleared && cryptCleared && nestCleared && missions.circle === "locked") missions.circle = "available";
          if (nextRun.flags.circle_chapter_complete || nextRun.flags.board_circle_complete) missions.circle = "complete";
          return {
            campaignRun: nextRun,
            credits,
            collection,
            fieldAcquired,
            cityCleared,
            chapterCleared,
            heroicCleared,
            recklessCleared,
            vaultCleared,
            vaultHeroicCleared,
            vaultRecklessCleared,
            hiveCleared,
            hiveHeroicCleared,
            hiveRecklessCleared,
            cryptCleared,
            cryptHeroicCleared,
            nestCleared,
            nestHeroicCleared,
            circleCleared,
            cosmeticsUnlocked,
            missions,
          };
        }),
      enterCampaignHq: () =>
        set((s) => {
          if (!s.campaignRun) return {};
          return { campaignRun: enterHq(s.campaignRun) };
        }),
      enterCampaignCrypt: () =>
        set((s) => {
          if (!s.campaignRun) return {};
          return { campaignRun: enterCrypt(s.campaignRun) };
        }),
      enterCampaignNest: () =>
        set((s) => {
          if (!s.campaignRun) return {};
          return { campaignRun: enterNest(s.campaignRun) };
        }),
      applyCampaignSafehouse: (nodeId, pick) =>
        set((s) => {
          const run = s.campaignRun;
          if (!run) return {};
          const board = getBoard(run.chapterId, run.boardId);
          const node = board ? getNode(board, nodeId) : undefined;
          if (!node) return {};
          const applied = applySafehousePick(run.deck, pick, nodeId);
          const ledger = [...run.ledger];
          for (const id of [...(node.rewards?.ledger_ids ?? []), ...applied.ledgerExtra]) {
            if (!ledger.includes(id)) ledger.push(id);
          }
          if ((node.id === "hq_armory" || node.id === "relic_vault" || node.id === "queen_chamber" || node.id === "tri_armory") && (pick.action === "add" || pick.action === "inject") && !ledger.includes("file_armory_pick")) {
            ledger.push("file_armory_pick");
          }
          const already = run.rewardsGranted.includes(nodeId);
          const rewardsGranted = already ? run.rewardsGranted : [...run.rewardsGranted, nodeId];
          let credits = s.credits;
          const collection = { ...s.collection };
          const fieldAcquired = [...s.fieldAcquired];
          if (!already) {
            const rw = NODE_FIRST_CLEAR[nodeId] ?? { credits: 0, cards: [] };
            credits += rw.credits;
            for (const id of rw.cards) {
              if (!getCard(id)) continue;
              collection[id] = (collection[id] ?? 0) + 1;
              if (!fieldAcquired.includes(id)) fieldAcquired.push(id);
            }
          }
          if ((pick.action === "add" || pick.action === "inject") && getCard(pick.id)) {
            collection[pick.id] = (collection[pick.id] ?? 0) + 1;
            if (!fieldAcquired.includes(pick.id)) fieldAcquired.push(pick.id);
          }
          const cleared = run.cleared.includes(nodeId) ? run.cleared : [...run.cleared, nodeId];
          return {
            campaignRun: {
              ...run,
              deck: applied.deck,
              deckLive: node.id === "vestry" || node.id === "molt" || node.id === "relic_vault" || node.id === "queen_chamber" || node.id === "tri_armory" ? true : pick.action !== "skip" ? true : run.deckLive,
              flags: { ...run.flags, ...applied.flags },
              ledger,
              cleared,
              rewardsGranted,
              currentNodeId: null,
              armoryPicks: [
                ...run.armoryPicks,
                { id: pick.id, label: pick.label, action: pick.action, node: nodeId },
              ],
            },
            credits,
            collection,
            fieldAcquired,
          };
        }),
      equipCosmetic: (id) =>
        set((s) => {
          const item = cosmeticById(id);
          if (!item) return {};
          const unlocked = mergeUnlocks(s, progressOf(s));
          if (!unlocked.includes(id) && !(s.cosmeticsUnlocked ?? []).includes(id)) return {};
          const slot: CosmeticSlot = item.slot;
          return { cosmeticsLoadout: { ...s.cosmeticsLoadout, [slot]: id } };
        }),
      applyCloudArchive: (blob, userId) =>
        set((s) => {
          const next = toArchiveBlob({ ...s, ...blob, campaignRun: blob.campaignRun });
          return {
            agentId: next.agentId,
            handle: next.handle,
            level: next.level,
            xp: next.xp,
            credits: next.credits,
            decrypted: next.decrypted,
            collection: next.collection,
            decks: next.decks.length ? next.decks : s.decks,
            activeDeckId: next.activeDeckId,
            missions: { ...s.missions, ...next.missions },
            wins: next.wins,
            losses: next.losses,
            packsOpened: next.packsOpened,
            cosmeticsUnlocked: mergeUnlocks({ ...s, ...next }, progressOf(next)),
            cosmeticsLoadout: next.cosmeticsLoadout,
            fieldAcquired: next.fieldAcquired,
            cityCleared: next.cityCleared,
            chapterCleared: next.chapterCleared,
            heroicCleared: next.heroicCleared,
            recklessCleared: next.recklessCleared,
            vaultCleared: next.vaultCleared,
            vaultHeroicCleared: next.vaultHeroicCleared,
            vaultRecklessCleared: next.vaultRecklessCleared,
            hiveCleared: next.hiveCleared,
            hiveHeroicCleared: next.hiveHeroicCleared,
            hiveRecklessCleared: next.hiveRecklessCleared,
            cryptCleared: next.cryptCleared,
            cryptHeroicCleared: next.cryptHeroicCleared,
            nestCleared: next.nestCleared,
            nestHeroicCleared: next.nestHeroicCleared,
            circleCleared: next.circleCleared,
            campaignRun: next.campaignRun,
            cloudBoundUserId: userId,
          };
        }),
      resetArchive: () => {
        const bound = get().cloudBoundUserId;
        set({ ...initial(), match: null, campaignRun: null, cloudBoundUserId: bound });
      },
    }),
    {
      name: "truth-exe-archive",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        agentId: s.agentId,
        handle: s.handle,
        level: s.level,
        xp: s.xp,
        credits: s.credits,
        decrypted: s.decrypted,
        collection: s.collection,
        decks: s.decks,
        activeDeckId: s.activeDeckId,
        missions: s.missions,
        wins: s.wins,
        losses: s.losses,
        packsOpened: s.packsOpened,
        campaignRun: s.campaignRun,
        cosmeticsUnlocked: s.cosmeticsUnlocked,
        cosmeticsLoadout: s.cosmeticsLoadout,
        fieldAcquired: s.fieldAcquired,
        cityCleared: s.cityCleared,
        chapterCleared: s.chapterCleared,
        heroicCleared: s.heroicCleared,
        recklessCleared: s.recklessCleared,
        vaultCleared: s.vaultCleared,
        vaultHeroicCleared: s.vaultHeroicCleared,
        vaultRecklessCleared: s.vaultRecklessCleared,
        hiveCleared: s.hiveCleared,
        hiveHeroicCleared: s.hiveHeroicCleared,
        hiveRecklessCleared: s.hiveRecklessCleared,
        cryptCleared: s.cryptCleared,
        cryptHeroicCleared: s.cryptHeroicCleared,
        nestCleared: s.nestCleared,
        nestHeroicCleared: s.nestHeroicCleared,
        circleCleared: s.circleCleared,
        cloudBoundUserId: s.cloudBoundUserId,
      }),
    },
  ),
);

export function ownedCopies(collection: Collection, id: string) {
  return collection[id] ?? 0;
}

export function discoveredCount(collection: Collection) {
  return Object.values(collection).filter((n) => n > 0).length;
}

export function archiveProgress(s: Pick<AgentState, "cityCleared" | "chapterCleared" | "heroicCleared" | "recklessCleared" | "vaultCleared" | "vaultHeroicCleared" | "vaultRecklessCleared" | "hiveCleared" | "hiveHeroicCleared" | "hiveRecklessCleared" | "cryptCleared" | "cryptHeroicCleared" | "nestCleared" | "nestHeroicCleared" | "circleCleared">): CosmeticProgress {
  return progressOf(s);
}

export type { Collection };
