export type CosmeticSlot = "cardBack" | "tableFelt" | "nameplate" | "title";

export type UnlockRule = "starter" | "city" | "chapter" | "heroic" | "reckless" | "vault" | "vaultHeroic" | "hive" | "hiveHeroic";

export type Cosmetic = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  blurb: string;
  src: string;
  unlock: UnlockRule;
  hint: string;
};

export type CosmeticLoadout = {
  cardBack: string;
  tableFelt: string;
  nameplate: string;
  title: string;
};

export type CosmeticProgress = {
  cityCleared: boolean;
  chapterCleared: boolean;
  heroicCleared: boolean;
  recklessCleared: boolean;
  vaultCleared: boolean;
  vaultHeroicCleared: boolean;
  hiveCleared: boolean;
  hiveHeroicCleared: boolean;
};

export const STARTER_LOADOUT: CosmeticLoadout = {
  cardBack: "back-archive",
  tableFelt: "felt-default",
  nameplate: "plate-archive",
  title: "title-archive",
};

export const COSMETICS: Cosmetic[] = [
  {
    id: "back-archive",
    slot: "cardBack",
    name: "Archive Sleeve",
    blurb: "Default Lodge stock. Everyone gets a pair.",
    src: "/cards/backs/illuminati-back.jpg",
    unlock: "starter",
    hint: "Issued on decrypt.",
  },
  {
    id: "back-network",
    slot: "cardBack",
    name: "Dead Drop Sleeve",
    blurb: "Network courier stock. Smells like rain.",
    src: "/cards/backs/network-back.jpg",
    unlock: "city",
    hint: "Clear City Initiation.",
  },
  {
    id: "back-circle",
    slot: "cardBack",
    name: "Inner Circle",
    blurb: "Gold eye on black stock. The Lodge notices.",
    src: "/ui/cosmetics/back-circle.jpg",
    unlock: "chapter",
    hint: "Close The Inner Circle.",
  },
  {
    id: "back-heroic",
    slot: "cardBack",
    name: "Grandmaster Foil",
    blurb: "Blood-gold leaf. You walked the Lodge on Heroic.",
    src: "/ui/cosmetics/back-heroic.jpg",
    unlock: "heroic",
    hint: "Close The Inner Circle on Heroic.",
  },
  {
    id: "felt-default",
    slot: "tableFelt",
    name: "Warehouse Felt",
    blurb: "The table they give you.",
    src: "/ui/chrome/table-surface.jpg",
    unlock: "starter",
    hint: "Issued on decrypt.",
  },
  {
    id: "felt-lodge",
    slot: "tableFelt",
    name: "Lodge Marble",
    blurb: "Gold inlay. The war table under HQ.",
    src: "/ui/cosmetics/felt-lodge.jpg",
    unlock: "chapter",
    hint: "Close The Inner Circle.",
  },
  {
    id: "felt-heroic",
    slot: "tableFelt",
    name: "Righteous Gold",
    blurb: "Fortitude burned into the stone.",
    src: "/ui/cosmetics/felt-heroic.jpg",
    unlock: "heroic",
    hint: "Close The Inner Circle on Heroic.",
  },
  {
    id: "plate-archive",
    slot: "nameplate",
    name: "Archive Plate",
    blurb: "Stamped steel. Agent issue.",
    src: "/ui/chrome/nameplate.jpg",
    unlock: "starter",
    hint: "Issued on decrypt.",
  },
  {
    id: "plate-lodge",
    slot: "nameplate",
    name: "Lodge Plate",
    blurb: "Influence hardware. You belong in the room.",
    src: "/ui/chrome/nameplate-illuminati.jpg",
    unlock: "chapter",
    hint: "Close The Inner Circle.",
  },
  {
    id: "plate-reckless",
    slot: "nameplate",
    name: "Reckless Plate",
    blurb: "Wax seal still wet. You skipped the drop.",
    src: "/ui/cosmetics/plate-reckless.jpg",
    unlock: "reckless",
    hint: "Skip Safe Drop, then close the chapter.",
  },
  {
    id: "title-archive",
    slot: "title",
    name: "ARCHIVE_7",
    blurb: "The handle they logged.",
    src: "",
    unlock: "starter",
    hint: "Issued on decrypt.",
  },
  {
    id: "title-initiate",
    slot: "title",
    name: "INITIATE",
    blurb: "City behind you. The Lodge ahead.",
    src: "",
    unlock: "city",
    hint: "Clear City Initiation.",
  },
  {
    id: "title-operative",
    slot: "title",
    name: "LODGE OPERATIVE",
    blurb: "Ops still has you on the radio.",
    src: "",
    unlock: "chapter",
    hint: "Close The Inner Circle.",
  },
  {
    id: "title-shadow",
    slot: "title",
    name: "GRANDMASTER'S SHADOW",
    blurb: "Heroic. The exit remembered you.",
    src: "",
    unlock: "heroic",
    hint: "Close The Inner Circle on Heroic.",
  },
  {
    id: "title-reckless",
    slot: "title",
    name: "RECKLESS",
    blurb: "No Safe Drop. Still standing.",
    src: "",
    unlock: "reckless",
    hint: "Skip Safe Drop, then close the chapter.",
  },
  {
    id: "back-templars",
    slot: "cardBack",
    name: "Reliquary Sleeve",
    blurb: "Gold cross on dark stock. Issued after the seal holds.",
    src: "/cards/backs/templars-back.jpg",
    unlock: "vault",
    hint: "Close Vault of Faith.",
  },
  {
    id: "plate-faith",
    slot: "nameplate",
    name: "Faith Plate",
    blurb: "Templar hardware. The hall remembers who stood.",
    src: "/ui/chrome/nameplate-templars.jpg",
    unlock: "vault",
    hint: "Close Vault of Faith.",
  },
  {
    id: "title-oathkeeper",
    slot: "title",
    name: "OATHKEEPER",
    blurb: "The Chaplain logged the name. The vault is quiet.",
    src: "",
    unlock: "vault",
    hint: "Close Vault of Faith.",
  },
  {
    id: "title-seal-warden",
    slot: "title",
    name: "SEAL WARDEN",
    blurb: "Heroic. You held the door on the hard path.",
    src: "",
    unlock: "vaultHeroic",
    hint: "Close Vault of Faith on Heroic.",
  },
  {
    id: "back-hive",
    slot: "cardBack",
    name: "Scale Sleeve",
    blurb: "Teal hex on black stock. Issued after the visor cracked.",
    src: "/cards/backs/reptilians-back.jpg",
    unlock: "hive",
    hint: "Close Psionic Hive.",
  },
  {
    id: "plate-hive",
    slot: "nameplate",
    name: "Hive Plate",
    blurb: "Reptilian hardware. The comb remembers who molted.",
    src: "/ui/chrome/nameplate-reptilians.jpg",
    unlock: "hive",
    hint: "Close Psionic Hive.",
  },
  {
    id: "title-hiveborn",
    slot: "title",
    name: "HIVEBORN",
    blurb: "The Voice logged the name. The hive is quiet.",
    src: "",
    unlock: "hive",
    hint: "Close Psionic Hive.",
  },
  {
    id: "title-mindkiller",
    slot: "title",
    name: "MINDKILLER",
    blurb: "Heroic. You broke the visor on the hard path.",
    src: "",
    unlock: "hiveHeroic",
    hint: "Close Psionic Hive on Heroic.",
  },
];

export const SLOT_LABEL: Record<CosmeticSlot, string> = {
  cardBack: "SLEEVE",
  tableFelt: "TABLE",
  nameplate: "PLATE",
  title: "CALLSIGN",
};

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}

export function cosmeticsForSlot(slot: CosmeticSlot): Cosmetic[] {
  return COSMETICS.filter((c) => c.slot === slot);
}

export function isCosmeticUnlocked(c: Cosmetic, progress: CosmeticProgress): boolean {
  if (c.unlock === "starter") return true;
  if (c.unlock === "city") return progress.cityCleared;
  if (c.unlock === "chapter") return progress.chapterCleared;
  if (c.unlock === "heroic") return progress.heroicCleared;
  if (c.unlock === "reckless") return progress.recklessCleared;
  if (c.unlock === "vault") return progress.vaultCleared;
  if (c.unlock === "vaultHeroic") return progress.vaultHeroicCleared;
  if (c.unlock === "hive") return progress.hiveCleared;
  if (c.unlock === "hiveHeroic") return progress.hiveHeroicCleared;
  return false;
}

export function unlocksFromProgress(progress: CosmeticProgress): string[] {
  return COSMETICS.filter((c) => isCosmeticUnlocked(c, progress)).map((c) => c.id);
}

export function cosmeticSrc(id: string, fallback = ""): string {
  return cosmeticById(id)?.src || fallback;
}

export function callsignOf(handle: string, titleId: string): string {
  const title = cosmeticById(titleId);
  if (!title || title.slot !== "title" || title.id === "title-archive") return handle;
  return title.name;
}

export function newlyUnlocked(before: string[], after: string[]): Cosmetic[] {
  const set = new Set(before);
  return after.filter((id) => !set.has(id)).map((id) => cosmeticById(id)).filter((c): c is Cosmetic => Boolean(c));
}
