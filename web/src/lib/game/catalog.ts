import rawCards from "@/data/cards.json";
import rawDecks from "@/data/decks.json";
import rawEncounters from "@/data/encounters.json";
import type {
  CardDef,
  DeckList,
  EncounterDef,
  FactionId,
  Keyword,
} from "./types";
import { FACTION_META } from "./types";

export const CARDS = rawCards as CardDef[];

const byId = new Map(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): CardDef | undefined {
  return byId.get(id);
}

export function mustCard(id: string): CardDef {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}

export function rulesText(card: CardDef): string {
  return (card.ability || card.effect || "").trim();
}

const KEYWORD_LIST: Keyword[] = [
  "Taunt",
  "Stealth",
  "Charge",
  "Rush",
  "Venom",
  "Drain",
  "Ward",
  "Shielding",
  "Enraged",
  "Silence",
  "Recur",
];

export function keywordsOf(card: CardDef): Keyword[] {
  const text = rulesText(card);
  return KEYWORD_LIST.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(text));
}

export function rarityOf(card: CardDef): "common" | "uncommon" | "rare" | "legendary" {
  if (card.cost >= 7) return "legendary";
  if (card.cost >= 5) return "rare";
  if (card.cost >= 3) return "uncommon";
  return "common";
}

export function artFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return {
    x: 20 + (h % 55),
    y: 18 + ((h >> 6) % 50),
    src: ["/art/hero.jpg", "/art/cam-alley.jpg", "/art/cam-garage.jpg", "/art/eye.jpg"][h % 4]!,
  };
}

export function energyCrystal(faction: FactionId): string {
  if (faction === "templars") return "/ui/energy/faith.jpg";
  if (faction === "reptilians") return "/ui/energy/psionics.jpg";
  if (faction === "illuminati") return "/ui/energy/influence.jpg";
  return "/ui/energy/empty.jpg";
}

export function powerArt(faction: Exclude<FactionId, "neutral">, ready: boolean) {
  return `/ui/powers/${faction}-${ready ? "on" : "off"}.jpg`;
}

export function nameplateArt(faction: Exclude<FactionId, "neutral">) {
  return `/ui/chrome/nameplate-${faction}.jpg`;
}

export const POWER_META: Record<
  Exclude<FactionId, "neutral">,
  { name: string; text: string }
> = {
  illuminati: { name: "Pull Strings", text: "Deal 1 to any target." },
  templars: { name: "Call Initiate", text: "Summon a 1/1 Taunt Initiate." },
  reptilians: { name: "Psi Lash", text: "Deal 2 to the enemy hero." },
};

export function plateFor(faction: FactionId): { front: string; back: string } {
  const file = FACTION_META[faction].file;
  return {
    front: `/cards/fronts/${file}-front.jpg`,
    back: `/cards/backs/${file}-back.jpg`,
  };
}

export function portraitFor(faction: FactionId): string {
  if (faction === "neutral") return "/art/hero.jpg";
  return `/ui/heroes/portrait-${faction}.jpg`;
}

type RawDecks = {
  illuminati: { name: string; description: string; cards: { id: string; copies: number }[] };
  templars: { name: string; description: string; cards: { id: string; copies: number }[] };
  reptilians: { name: string; description: string; cards: { id: string; copies: number }[] };
  presets: {
    id: string;
    name: string;
    faction: "illuminati" | "templars" | "reptilians";
    description: string;
    cards: { id: string; copies: number }[];
    campaign?: string;
  }[];
};

const decksJson = rawDecks as RawDecks;

export const CURATED_DECKS: DeckList[] = [
  {
    id: "illuminati",
    name: decksJson.illuminati.name,
    faction: "illuminati",
    description: decksJson.illuminati.description,
    cards: decksJson.illuminati.cards,
  },
  {
    id: "templars",
    name: decksJson.templars.name,
    faction: "templars",
    description: decksJson.templars.description,
    cards: decksJson.templars.cards,
  },
  {
    id: "reptilians",
    name: decksJson.reptilians.name,
    faction: "reptilians",
    description: decksJson.reptilians.description,
    cards: decksJson.reptilians.cards,
  },
];

export const PRESET_DECKS: DeckList[] = decksJson.presets
  .filter((p) => !p.campaign)
  .map((p) => ({
    id: p.id,
    name: p.name,
    faction: p.faction,
    description: p.description,
    cards: p.cards,
  }));

export function expandDeck(list: { id: string; copies: number }[]): string[] {
  const ids: string[] = [];
  for (const row of list) {
    for (let i = 0; i < row.copies; i++) ids.push(row.id);
  }
  return ids;
}

export function deckCount(list: { id: string; copies: number }[]): number {
  return list.reduce((n, r) => n + r.copies, 0);
}

export function networkCount(list: { id: string; copies: number }[]): number {
  return list.reduce((n, r) => {
    const c = getCard(r.id);
    return n + (c?.faction === "neutral" ? r.copies : 0);
  }, 0);
}

const encountersJson = rawEncounters as Record<string, EncounterDef>;

export const ENCOUNTERS: EncounterDef[] = Object.values(encountersJson);

export function getEncounter(id: string): EncounterDef | undefined {
  return encountersJson[id];
}

export const TUTORIAL = encountersJson.tutorial;
export const KEYWORD_LAB = encountersJson.keyword_lab;

export function cardsByFaction(faction: FactionId): CardDef[] {
  return CARDS.filter((c) => c.faction === faction);
}

export function collectibleCards(): CardDef[] {
  return CARDS.filter((c) => c.id !== "neutral_char_008");
}

export const INITIATE: CardDef = {
  id: "token_initiate",
  name: "Initiate",
  type: "Character",
  faction: "templars",
  cost: 1,
  energy_type: "Faith",
  attack: 1,
  health: 1,
  ability: "Taunt. Token.",
  lore: "Every chapel still keeps a spare oath and a spare sword.",
};

export function resolveCard(id: string): CardDef | undefined {
  if (id === "token_initiate") return INITIATE;
  return getCard(id);
}

export const STARTER_UNLOCKS: string[] = (() => {
  const ids = new Set<string>();
  for (const d of CURATED_DECKS) {
    for (const row of d.cards) ids.add(row.id);
  }
  for (const id of TUTORIAL.player_deck ?? []) ids.add(id);
  for (const id of TUTORIAL.ai_deck ?? []) ids.add(id);
  return [...ids];
})();
