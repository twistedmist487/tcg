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
  eotAtk: number;
  eotHp: number;
  eotTaunt: boolean;
  innateTaunt: boolean;
  recurUsed: boolean;
  eotSilence: boolean;
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
  hallowedUsed: boolean;
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
  tutorialStep: string | null;
  campaign: CampaignMatch | null;
  crisis: CrisisState | null;
  twist: TwistState | null;
};

export type DeckList = {
  id: string;
  name: string;
  faction: Exclude<FactionId, "neutral">;
  description: string;
  cards: { id: string; copies: number }[];
  custom?: boolean;
};

export type EncounterStep = {
  id: string;
  title: string;
  text: string;
};

export type CampaignStep = EncounterStep & {
  require?: string;
  highlight?: string;
};

export type StoryPanel = { text: string };

export type SafehousePick = {
  id: string;
  label: string;
  blurb: string;
  action: "add" | "inject" | "prune" | "skip";
  copies?: number;
  trim?: string[];
  prune_id?: string;
  skip_reverse_node?: string;
};

export type CampaignTwist = {
  id: string;
  label: string;
  description: string;
  match_modifiers?: {
    enemy_character_health_bonus?: number;
    first_character_health_bonus?: number;
    negate_every_n_spells?: number;
  };
};

export type CampaignNodeReverse = {
  title?: string;
  blurb?: string;
  type?: "story" | "combat" | "crisis" | "safehouse" | "boss";
  ai?: { difficulty?: "easy" | "medium" | "hard"; name?: string; faction?: string };
  ai_starting_life?: number;
  player_goes_first?: boolean;
  shuffle?: boolean;
  player_deck?: string[] | { id: string; copies: number }[];
  ai_deck?: string[] | { id: string; copies: number }[];
  twist?: CampaignTwist;
  dialogue?: { speaker: string; text: string }[];
  player_deck_mode?: "scripted" | "run" | "run_teach";
  coach?: "recruiter" | "ops" | "silent" | "chaplain" | "voice";
  skip_blurb?: string;
  steps?: CampaignStep[];
  teach?: boolean;
};

export type CampaignNode = {
  id: string;
  type: "story" | "combat" | "crisis" | "safehouse" | "boss";
  title: string;
  blurb: string;
  map: { x: number; y: number };
  requires: string[];
  unlocks: string[];
  ai?: { difficulty?: "easy" | "medium" | "hard"; name?: string; faction?: string };
  player_goes_first?: boolean;
  shuffle?: boolean;
  ai_starting_life?: number;
  player_deck?: string[] | { id: string; copies: number }[];
  ai_deck?: string[] | { id: string; copies: number }[];
  teach?: boolean;
  steps?: CampaignStep[];
  dialogue?: { speaker: string; text: string }[];
  rewards?: {
    ledger_ids?: string[];
    flags?: Record<string, boolean>;
    next_board?: string;
  };
  lesson_win?: string;
  lesson_loss?: string;
  player_deck_mode?: "scripted" | "run" | "run_teach";
  teach_seed_ids?: string[];
  coach?: "recruiter" | "ops" | "silent" | "chaplain" | "voice";
  story_panels?: StoryPanel[];
  story_panels_on_enter?: StoryPanel[];
  story_panels_reckless?: StoryPanel[];
  safehouse?: { text: string; pick_one_of: SafehousePick[] };
  crisis?: { win: "survive_turns"; turns: number; label: string };
  reverse?: CampaignNodeReverse;
  triggers_reverse?: boolean;
  boss_requires_reverse_clear?: boolean;
  twist?: CampaignTwist;
};

export type CampaignBoard = {
  id: string;
  name: string;
  chapter_id: string;
  start_node: string;
  map_hint: string;
  reverse_order?: string[];
  boss_node?: string;
  nodes: CampaignNode[];
  ledger: Record<string, { title: string; text: string }>;
};

export type CampaignPhase = "forward" | "reverse" | "boss" | "city_complete" | "done";

export type CampaignRun = {
  version: 1;
  chapterId: string;
  boardId: string;
  difficulty: "normal" | "heroic";
  phase: CampaignPhase;
  cleared: string[];
  reverseCleared: string[];
  ledger: string[];
  flags: Record<string, boolean | string>;
  armoryPicks: { id: string; label?: string; action: string; node: string }[];
  deckId: string;
  deck: string[];
  deckLive: boolean;
  rewardsGranted: string[];
  currentNodeId: string | null;
};

export type CampaignMatch = {
  chapterId: string;
  boardId: string;
  nodeId: string;
  nodeTitle: string;
  coach: "recruiter" | "ops" | "silent" | "chaplain" | "voice";
  teach: boolean;
  steps: CampaignStep[];
  lessonWin?: string;
  lessonLoss?: string;
  twistLabel?: string;
};

export type CrisisState = {
  win: "survive_turns";
  turnsRequired: number;
  turnsCompleted: number;
  label: string;
};

export type TwistState = {
  id: string;
  label: string;
  description: string;
  enemyHealthBonus: number;
  firstCharacterHealthBonus: number;
  negateEveryN: number;
  spellsCast: number;
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
  steps?: EncounterStep[];
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
