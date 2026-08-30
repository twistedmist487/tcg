import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CURATED_DECKS,
  STARTER_UNLOCKS,
  collectibleCards,
  getCard,
} from "@/lib/game/catalog";
import type { DeckList, MatchState } from "@/lib/game/types";

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
};

type Store = AgentState & {
  match: MatchState | null;
  setMatch: (m: MatchState | null) => void;
  addXp: (n: number) => void;
  addCredits: (n: number) => void;
  decrypt: () => void;
  grantCard: (id: string, n?: number) => void;
  saveDeck: (deck: DeckList) => void;
  deleteDeck: (id: string) => void;
  setActiveDeck: (id: string) => void;
  completeMission: (id: string) => void;
  recordMatch: (won: boolean) => void;
  resetArchive: () => void;
};

const STARTER_MISSIONS: Record<string, MissionStatus> = {
  tutorial: "available",
  keyword_lab: "available",
  showcase_illuminati: "available",
  showcase_templars: "available",
  showcase_reptilians: "available",
  illuminati: "available",
  challenge_black_room: "locked",
  challenge_street_war: "locked",
  challenge_unquiet: "locked",
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
});

export const useArchive = create<Store>()(
  persist(
    (set, get) => ({
      ...initial(),
      match: null,
      setMatch: (m) => set({ match: m }),
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
      resetArchive: () => set({ ...initial(), match: null }),
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

export type { Collection };

