export type FactionId = "illuminati" | "templars" | "reptilians" | "neutral";

export type CardType = "Character" | "Spell" | "Location";

export type CardDef = {
  id: string;
  name: string;
  type: CardType;
  faction: FactionId;
  cost: number;
  energy_type: string;
  attack?: number | null;
  health?: number | null;
  ability?: string;
  effect?: string;
  lore?: string;
};

export type Keyword =
  | "Taunt"
  | "Stealth"
  | "Charge"
  | "Rush"
  | "Venom"
  | "Drain"
  | "Ward"
  | "Shielding"
  | "Enraged"
  | "Silence"
  | "Recur";

export type CardInst = {
  iid: string;
  cardId: string;
  atk: number;
  hp: number;
  maxHp: number;
  exhausted: boolean;
  stealth: boolean;
  taunt: boolean;
  charge: boolean;
  rush: boolean;
  venom: boolean;
  drain: boolean;
  shielding: boolean;
  ward: boolean;
  silenced: boolean;
  enraged: boolean;
  attackedThisTurn: number;
};

export type SideId = "player" | "ai";

export type SideState = {
  id: SideId;
  name: string;
  faction: Exclude<FactionId, "neutral">;
  life: number;
  energy: number;
  maxEnergy: number;
  deck: string[];
  hand: CardInst[];
  board: CardInst[];
  location: CardInst | null;
  powerUsed: boolean;
  fatigue: number;
};

export type Phase = "mulligan" | "main" | "ai" | "over";

export type PendingTarget = {
  kind: "spell" | "attack" | "power" | "playMinion";
  sourceIid?: string;
  cardId?: string;
  handIndex?: number;
  prompt: string;
};

export type MatchState = {
  seed: number;
  turn: number;
  current: SideId;
  phase: Phase;
  winner: SideId | null;
  player: SideState;
  ai: SideState;
  log: string[];
  pending: PendingTarget | null;
  nextIid: number;
  difficulty: "easy" | "medium" | "hard";
  encounterId: string;
  playerGoesFirst: boolean;
};

export type DeckList = {
  id: string;
  name: string;
  faction: Exclude<FactionId, "neutral">;
  description: string;
  cards: { id: string; copies: number }[];
  custom?: boolean;
};

export type EncounterDef = {
  id: string;
  name: string;
  description: string;
  mode: string;
  difficulty: "easy" | "medium" | "hard";
  player_faction: Exclude<FactionId, "neutral">;
  ai_faction: Exclude<FactionId, "neutral">;
  ai_name: string;
  player_name?: string;
  ai_starting_life?: number;
  player_deck?: string[];
  ai_deck?: string[];
  player_deck_faction?: string;
  ai_deck_faction?: string;
  player_goes_first?: boolean;
  shuffle?: boolean;
};

export const FACTION_META: Record<
  FactionId,
  { name: string; energy: string; tagline: string; file: string }
> = {
  illuminati: {
    name: "The Illuminati",
    energy: "Influence",
    tagline: "Control the room. Empty their hand.",
    file: "illuminati",
  },
  templars: {
    name: "The Templars",
    energy: "Faith",
    tagline: "Walls, relics, and holy fire.",
    file: "templars",
  },
  reptilians: {
    name: "The Reptilians",
    energy: "Psionics",
    tagline: "Swarm, stealth, and the hive.",
    file: "reptilians",
  },
  neutral: {
    name: "The Network",
    energy: "Conspiracy",
    tagline: "Freelancers. Anyone can hire them.",
    file: "network",
  },
};
