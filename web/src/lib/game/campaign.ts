import campaignIndex from "@/data/campaign/index.json";
import illuminatiChapter from "@/data/campaign/illuminati/chapter.json";
import cityBoardJson from "@/data/campaign/illuminati/board_city.json";
import hqBoardJson from "@/data/campaign/illuminati/board_hq.json";
import templarsChapter from "@/data/campaign/templars/chapter.json";
import vaultBoardJson from "@/data/campaign/templars/board_vault.json";
import reptiliansChapter from "@/data/campaign/reptilians/chapter.json";
import hiveBoardJson from "@/data/campaign/reptilians/board_hive.json";
import { expandDeck, getCard } from "./catalog";
import rawDecks from "@/data/decks.json";
import type {
  CampaignBoard,
  CampaignNode,
  CampaignRun,
  CampaignStep,
  SafehousePick,
  StoryPanel,
} from "./types";

const DEFAULT_TRIM = [
  "neutral_char_028",
  "neutral_spell_022",
  "neutral_char_001",
  "illuminati_char_009",
];

const MAX_COPIES = 2;
const MAX_DECK = 30;

type RawDecks = {
  presets: { id: string; cards: { id: string; copies: number }[] }[];
};

export const CAMPAIGN_CHAPTERS = (
  campaignIndex as {
    chapters: {
      id: string;
      name: string;
      faction: string;
      description: string;
      status: string;
      starter_board: string;
      art?: string;
    }[];
  }
).chapters;

const CITY_BOARD = cityBoardJson as CampaignBoard;
const HQ_BOARD = hqBoardJson as CampaignBoard;
const VAULT_BOARD = vaultBoardJson as CampaignBoard;
const HIVE_BOARD = hiveBoardJson as CampaignBoard;

type ChapterMeta = {
  id: string;
  name: string;
  faction: string;
  starter_deck_id: string;
  boards: string[];
};

export function loadChapter(chapterId: string) {
  if (chapterId === "templars") {
    return {
      ...(templarsChapter as ChapterMeta),
      board_data: { vault: VAULT_BOARD } as Record<string, CampaignBoard>,
    };
  }
  if (chapterId === "reptilians") {
    return {
      ...(reptiliansChapter as ChapterMeta),
      board_data: { hive: HIVE_BOARD } as Record<string, CampaignBoard>,
    };
  }
  if (chapterId !== "illuminati") return null;
  return {
    ...(illuminatiChapter as ChapterMeta),
    board_data: { city: CITY_BOARD, hq: HQ_BOARD } as Record<string, CampaignBoard>,
  };
}

export function getCityBoard(): CampaignBoard {
  return CITY_BOARD;
}

export function getBoard(chapterId: string, boardId: string): CampaignBoard | null {
  const ch = loadChapter(chapterId);
  return ch?.board_data[boardId] ?? null;
}

export function getNode(board: CampaignBoard, nodeId: string): CampaignNode | undefined {
  return board.nodes.find((n) => n.id === nodeId);
}

export function expandPresetIds(presetId: string): string[] {
  const presets = (rawDecks as RawDecks).presets ?? [];
  const preset = presets.find((p) => p.id === presetId);
  if (!preset) return [];
  return expandDeck(preset.cards);
}

export function flattenDeckIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") out.push(item);
    else if (item && typeof item === "object" && "id" in item) {
      const row = item as { id: string; copies?: number };
      const copies = Math.max(1, Number(row.copies ?? 1));
      for (let i = 0; i < copies; i++) out.push(row.id);
    }
  }
  return out;
}

export function countCopies(deck: string[], cardId: string) {
  return deck.filter((id) => id === cardId).length;
}

export function trimDeck(deck: string[], size = MAX_DECK, preferRemove: string[] = DEFAULT_TRIM): string[] {
  const out = [...deck];
  while (out.length > size) {
    let removed = false;
    for (const cardId of preferRemove) {
      const idx = out.lastIndexOf(cardId);
      if (idx >= 0) {
        out.splice(idx, 1);
        removed = true;
        break;
      }
    }
    if (!removed) out.pop();
  }
  return out;
}

export function addCardToDeck(deck: string[], cardId: string, copies = 1, preferRemove: string[] = DEFAULT_TRIM): string[] {
  const out = [...deck];
  for (let i = 0; i < copies; i++) {
    if (countCopies(out, cardId) >= MAX_COPIES) break;
    out.push(cardId);
  }
  return trimDeck(out, MAX_DECK, preferRemove);
}

export function pruneCardFromDeck(deck: string[], cardId: string): string[] {
  const out = [...deck];
  const idx = out.indexOf(cardId);
  if (idx >= 0) out.splice(idx, 1);
  return out;
}

export function applySafehousePick(
  deck: string[],
  pick: SafehousePick,
): {
  deck: string[];
  flags: Record<string, boolean | string>;
  ledgerExtra: string[];
} {
  const action = (pick.action || "").toLowerCase();
  const flags: Record<string, boolean | string> = {};
  const ledgerExtra: string[] = [];
  const trim = pick.trim?.length ? pick.trim : DEFAULT_TRIM;
  let next = [...deck];

  if (action === "add" || action === "inject") {
    next = addCardToDeck(next, pick.id, pick.copies ?? 1, trim);
    flags.last_deck_change = `added:${pick.id}`;
    flags.last_armory_pick = pick.label || pick.id;
  } else if (action === "prune") {
    next = pruneCardFromDeck(next, pick.prune_id || pick.id);
    flags.last_deck_change = `pruned:${pick.prune_id || pick.id}`;
  } else if (action === "skip") {
    flags.skipped_safe_drop = true;
    flags.last_deck_change = "skipped";
    ledgerExtra.push("file_reckless");
  }

  if (pick.skip_reverse_node) flags.skip_reverse_node = pick.skip_reverse_node;

  return { deck: next, flags, ledgerExtra };
}

export function seedTeachFront(deck: string[], seedIds: string[]): string[] {
  const out = [...deck];
  const front: string[] = [];
  for (const cardId of seedIds) {
    const idx = out.indexOf(cardId);
    if (idx >= 0) out.splice(idx, 1);
    front.push(cardId);
  }
  return [...front, ...out];
}

export function campaignCoachId(run: CampaignRun | null, node?: CampaignNode): "recruiter" | "ops" | "silent" | "chaplain" | "voice" {
  if (node?.coach === "silent") return "silent";
  if (node?.coach === "voice" || run?.chapterId === "reptilians") return "voice";
  if (node?.coach === "chaplain" || run?.chapterId === "templars") return "chaplain";
  if (run?.flags.recruiter_dead || run?.boardId === "hq") return "ops";
  if (node?.coach === "ops" || node?.coach === "recruiter") return node.coach;
  return "recruiter";
}

export function reverseQueue(run: CampaignRun, board: CampaignBoard): string[] {
  const skip = run.flags.skip_reverse_node;
  return (board.reverse_order ?? []).filter((id) => id !== skip);
}

export function reverseAllClear(run: CampaignRun, board: CampaignBoard): boolean {
  const q = reverseQueue(run, board);
  const cleared = run.reverseCleared ?? [];
  return q.length > 0 && q.every((id) => cleared.includes(id));
}

export function resolveCampaignNode(run: CampaignRun, node: CampaignNode, board: CampaignBoard): CampaignNode {
  const q = reverseQueue(run, board);
  if ((run.phase === "reverse" || run.phase === "boss") && node.reverse && q.includes(node.id)) {
    const r = node.reverse;
    return {
      ...node,
      ...r,
      id: node.id,
      rewards: node.rewards,
      title: r.title ?? node.title,
      blurb: r.blurb ?? node.blurb,
      steps: r.steps ?? [],
      teach: r.teach ?? false,
    };
  }
  return node;
}

export function isNodeUnlocked(run: CampaignRun, node: CampaignNode): boolean {
  if (!node.requires.length) return true;
  return node.requires.every((id) => run.cleared.includes(id));
}

export function nodeStatus(run: CampaignRun, node: CampaignNode, board: CampaignBoard): "cleared" | "open" | "locked" {
  const reverseCleared = run.reverseCleared ?? [];
  const skip = run.flags.skip_reverse_node;

  if (node.boss_requires_reverse_clear) {
    if (run.flags.illuminati_chapter_complete || run.phase === "done") return "cleared";
    if (run.phase === "boss" || (run.phase === "reverse" && reverseAllClear(run, board))) return "open";
    return "locked";
  }

  if (run.phase === "reverse") {
    const q = reverseQueue(run, board);
    if (skip === node.id) return "cleared";
    if (!q.includes(node.id)) return run.cleared.includes(node.id) ? "cleared" : "locked";
    if (reverseCleared.includes(node.id)) return "cleared";
    const next = q.find((id) => !reverseCleared.includes(id));
    return node.id === next ? "open" : "locked";
  }

  if (run.phase === "boss" || run.phase === "done") {
    const q = reverseQueue(run, board);
    if (q.includes(node.id) || skip === node.id) {
      if (skip === node.id) return "cleared";
      return reverseCleared.includes(node.id) ? "cleared" : "locked";
    }
    return run.cleared.includes(node.id) ? "cleared" : "locked";
  }

  if (run.cleared.includes(node.id)) return "cleared";
  if (isNodeUnlocked(run, node)) return "open";
  return "locked";
}

export function applyNodeClear(run: CampaignRun, node: CampaignNode, board: CampaignBoard): CampaignRun {
  let next: CampaignRun = {
    ...run,
    flags: { ...run.flags },
    ledger: [...run.ledger],
    cleared: [...run.cleared],
    reverseCleared: [...(run.reverseCleared ?? [])],
  };

  const rewards = node.rewards ?? {};
  for (const id of rewards.ledger_ids ?? []) {
    if (!next.ledger.includes(id)) next.ledger.push(id);
  }
  Object.assign(next.flags, rewards.flags ?? {});

  if (next.phase === "reverse" && reverseQueue(next, board).includes(node.id)) {
    if (!next.reverseCleared.includes(node.id)) next.reverseCleared.push(node.id);
    if (reverseAllClear(next, board)) next.phase = "boss";
  } else if (!node.boss_requires_reverse_clear) {
    if (!next.cleared.includes(node.id)) next.cleared.push(node.id);
  } else if (!next.cleared.includes(node.id)) {
    next.cleared.push(node.id);
  }

  if (node.triggers_reverse) {
    next.phase = "reverse";
    const skip = next.flags.skip_reverse_node;
    if (typeof skip === "string" && skip && !next.reverseCleared.includes(skip)) {
      next.reverseCleared.push(skip);
      if (!next.ledger.includes("file_elevator")) next.ledger.push("file_elevator");
    }
    if (reverseAllClear(next, board)) next.phase = "boss";
  }

  if (next.flags.illuminati_chapter_complete || next.flags.templars_chapter_complete || next.flags.reptilians_chapter_complete) next.phase = "done";

  if (rewards.next_board && rewards.next_board !== next.boardId) {
    next = {
      ...next,
      boardId: rewards.next_board,
      phase: "forward",
      cleared: [],
      reverseCleared: [],
    };
  }

  next.currentNodeId = null;
  return next;
}

export function enterHq(run: CampaignRun): CampaignRun {
  return {
    ...run,
    boardId: "hq",
    phase: "forward",
    cleared: [],
    reverseCleared: [],
    currentNodeId: null,
  };
}

export function storyPanelsFor(run: CampaignRun, node: CampaignNode): StoryPanel[] {
  if (run.flags.skipped_safe_drop && node.story_panels_reckless?.length) return node.story_panels_reckless;
  return node.story_panels ?? [{ text: node.blurb }];
}

export function mapLinks(board: CampaignBoard, run: CampaignRun): { from: CampaignNode; to: CampaignNode }[] {
  if (run.phase === "reverse" || run.phase === "boss") {
    const ids = [...reverseQueue(run, board)];
    if (board.boss_node) ids.push(board.boss_node);
    const out: { from: CampaignNode; to: CampaignNode }[] = [];
    for (let i = 0; i < ids.length - 1; i++) {
      const a = getNode(board, ids[i]!);
      const b = getNode(board, ids[i + 1]!);
      if (a && b) out.push({ from: a, to: b });
    }
    return out;
  }
  const out: { from: CampaignNode; to: CampaignNode }[] = [];
  for (const n of board.nodes) {
    for (const u of n.unlocks) {
      const to = getNode(board, u);
      if (to) out.push({ from: n, to });
    }
  }
  return out;
}

export function boardArt(boardId: string) {
  if (boardId === "hq") return "/ui/campaign/hq-board.jpg";
  if (boardId === "vault") return "/ui/campaign/vault-board.jpg";
  if (boardId === "hive") return "/ui/campaign/hive-board.jpg";
  return "/ui/campaign/city-board.jpg";
}

export function boardHint(run: CampaignRun, board: CampaignBoard) {
  if (run.phase === "reverse") {
    return "Fight back through the halls. Righteous Fortitude is active. Your kit is the one you built.";
  }
  if (run.phase === "boss") return "The Grandmaster holds the entrance. Ops is on the radio.";
  if (run.phase === "done") {
    if (board.id === "hive") return "The hive is quiet. Review the ledger or abandon to restart.";
    return board.id === "vault"
      ? "The seal holds. Review the ledger or abandon to restart."
      : "Chapter complete. Review the ledger or abandon to restart.";
  }
  if (run.phase === "city_complete") return "You escaped. The Lodge is waiting.";
  return board.map_hint;
}

export function boardKicker(run: CampaignRun, board: CampaignBoard) {
  const heroic = run.difficulty === "heroic" ? " · HEROIC" : "";
  if (board.id === "hive") {
    if (run.phase === "done") return `// HIVE — QUIET${heroic}`;
    return `// PSIONIC HIVE${heroic}`;
  }
  if (board.id === "vault") {
    if (run.phase === "done") return `// VAULT — SECURE${heroic}`;
    return `// VAULT OF FAITH${heroic}`;
  }
  if (board.id === "hq") {
    if (run.phase === "reverse") return `// HQ — BREACH${heroic}`;
    if (run.phase === "boss") return `// HQ — EXIT${heroic}`;
    if (run.phase === "done") return `// INNER CIRCLE — CLOSED${heroic}`;
    return `// ILLUMINATI HQ${heroic}`;
  }
  return `// CITY INITIATION${heroic}`;
}

export function ledgerFile(id: string, run: CampaignRun): { title: string; text: string } | undefined {
  if (id === "file_armory_pick") {
    return {
      title: "File: Armory Pick",
      text: run.flags.last_armory_pick
        ? `Sleeved into the kit: ${run.flags.last_armory_pick}.`
        : "A tool was taken from the black budget.",
    };
  }
  return CITY_BOARD.ledger[id] ?? HQ_BOARD.ledger[id] ?? VAULT_BOARD.ledger[id] ?? HIVE_BOARD.ledger[id];
}

export const NODE_ART: Record<string, string> = {
  story_intro: "/ui/campaign/story-watched.jpg",
  alley_contact: "/ui/campaign/story-watched.jpg",
  archives: "/ui/campaign/story-archives.jpg",
  safe_drop: "/ui/campaign/story-safe-drop.jpg",
  rooftop: "/ui/campaign/story-rooftop.jpg",
  initiation: "/ui/campaign/recruiter.jpg",
  escape: "/ui/campaign/story-ambush.jpg",
  hq_arrival: "/ui/campaign/hq-board.jpg",
  train_silence: "/ui/campaign/story-silence.jpg",
  train_discard: "/ui/campaign/story-archives.jpg",
  train_bounce: "/ui/campaign/hq-board.jpg",
  hq_armory: "/ui/campaign/story-armory.jpg",
  hq_breach: "/ui/campaign/story-breach.jpg",
  grandmaster: "/ui/campaign/grandmaster.jpg",
  vault_intro: "/ui/campaign/chaplain.jpg",
  nave_watch: "/ui/campaign/story-nave.jpg",
  infirmary: "/ui/campaign/chaplain.jpg",
  vestry: "/ui/campaign/story-heist.jpg",
  crypt_rush: "/ui/campaign/story-heist.jpg",
  inner_gate: "/ui/campaign/vault-board.jpg",
  guardian: "/ui/campaign/guardian.jpg",
  hive_intro: "/ui/campaign/voice.jpg",
  comb_watch: "/ui/campaign/story-nest.jpg",
  psi_den: "/ui/campaign/voice.jpg",
  molt: "/ui/campaign/story-abduct.jpg",
  static_field: "/ui/campaign/story-static.jpg",
  inner_comb: "/ui/campaign/hive-board.jpg",
  slaver: "/ui/campaign/slaver.jpg",
};

export const NODE_FIRST_CLEAR: Record<string, { credits: number; cards: string[] }> = {
  story_intro: { credits: 20, cards: [] },
  alley_contact: { credits: 40, cards: ["illuminati_char_009"] },
  archives: { credits: 40, cards: ["neutral_char_007"] },
  safe_drop: { credits: 30, cards: [] },
  rooftop: { credits: 50, cards: ["neutral_char_010"] },
  initiation: { credits: 80, cards: ["illuminati_char_001"] },
  escape: { credits: 120, cards: [] },
  hq_arrival: { credits: 20, cards: [] },
  train_silence: { credits: 50, cards: ["illuminati_spell_001"] },
  train_discard: { credits: 50, cards: ["illuminati_spell_002"] },
  train_bounce: { credits: 50, cards: ["illuminati_spell_012"] },
  hq_armory: { credits: 40, cards: [] },
  hq_breach: { credits: 40, cards: [] },
  grandmaster: { credits: 200, cards: ["illuminati_char_005"] },
  "reverse:train_bounce": { credits: 70, cards: [] },
  "reverse:train_discard": { credits: 70, cards: [] },
  "reverse:train_silence": { credits: 70, cards: [] },
  vault_intro: { credits: 20, cards: [] },
  nave_watch: { credits: 40, cards: ["templars_char_009"] },
  infirmary: { credits: 40, cards: ["templars_char_006"] },
  vestry: { credits: 30, cards: [] },
  crypt_rush: { credits: 50, cards: ["templars_char_012"] },
  inner_gate: { credits: 50, cards: ["templars_char_001"] },
  guardian: { credits: 200, cards: ["templars_char_005"] },
  hive_intro: { credits: 20, cards: [] },
  comb_watch: { credits: 40, cards: ["reptilians_char_015"] },
  psi_den: { credits: 40, cards: ["reptilians_char_009"] },
  molt: { credits: 30, cards: [] },
  static_field: { credits: 50, cards: ["reptilians_spell_011"] },
  inner_comb: { credits: 50, cards: ["reptilians_char_001"] },
  slaver: { credits: 200, cards: ["reptilians_char_002"] },
};

export function rewardKey(run: CampaignRun, nodeId: string) {
  return run.phase === "reverse" ? `reverse:${nodeId}` : nodeId;
}

export function newCampaignRun(
  chapterId = "illuminati",
  difficulty: CampaignRun["difficulty"] = "normal",
): CampaignRun {
  const chapter = loadChapter(chapterId);
  const starterId = chapter?.starter_deck_id ?? "campaign_illuminati_city_starter";
  const boardId = chapter?.boards[0] ?? "city";
  return {
    version: 1,
    chapterId,
    boardId,
    difficulty,
    phase: "forward",
    cleared: [],
    reverseCleared: [],
    ledger: [],
    flags: {},
    armoryPicks: [],
    deckId: starterId,
    deck: expandPresetIds(starterId),
    deckLive: false,
    rewardsGranted: [],
    currentNodeId: null,
  };
}

export function matchPlayerDeck(run: CampaignRun, node: CampaignNode): { ids: string[]; shuffle: boolean } {
  const mode = node.player_deck_mode ?? (node.player_deck?.length ? "scripted" : "run");
  if (mode === "scripted") {
    return { ids: flattenDeckIds(node.player_deck), shuffle: node.shuffle !== false };
  }
  let deck = run.deck.length ? [...run.deck] : expandPresetIds(run.deckId);
  if (mode === "run_teach") {
    return { ids: seedTeachFront(deck, node.teach_seed_ids ?? []), shuffle: false };
  }
  return { ids: deck, shuffle: node.shuffle !== false };
}

export function kitSummary(deck: string[]) {
  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, copies]) => ({
      id,
      copies,
      name: getCard(id)?.name ?? id,
      cost: getCard(id)?.cost ?? 0,
    }))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}

export function storyArtFor(node: CampaignNode): string {
  if (NODE_ART[node.id]) return NODE_ART[node.id]!;
  if (node.id.startsWith("hq") || node.id.startsWith("train") || node.id === "grandmaster") {
    return "/ui/campaign/hq-board.jpg";
  }
  if (node.id === "guardian" || node.id.startsWith("vault") || node.id.startsWith("nave") || node.id === "vestry" || node.id === "infirmary" || node.id === "crypt_rush" || node.id === "inner_gate") {
    return "/ui/campaign/vault-board.jpg";
  }
  if (node.id === "slaver" || node.id.startsWith("hive") || node.id === "comb_watch" || node.id === "psi_den" || node.id === "molt" || node.id === "static_field" || node.id === "inner_comb") {
    return "/ui/campaign/hive-board.jpg";
  }
  return "/ui/campaign/city-board.jpg";
}

export function nodeKindLabel(node: CampaignNode): string {
  if (node.type === "story") return "BRIEFING";
  if (node.type === "safehouse") return "CONTACT";
  if (node.type === "crisis") return "CRISIS";
  if (node.type === "boss") return "TRIAL";
  return "CONTACT";
}

export function campaignStepsOf(node: CampaignNode): CampaignStep[] {
  return (node.steps ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    text: s.text,
    require: s.require,
    highlight: s.highlight,
  }));
}
