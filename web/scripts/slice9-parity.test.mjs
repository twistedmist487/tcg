import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const engine = await vite.ssrLoadModule("/src/lib/game/engine.ts");
const campaign = await vite.ssrLoadModule("/src/lib/game/campaign.ts");
const launch = await vite.ssrLoadModule("/src/lib/game/launch.ts");
const cosmetics = await vite.ssrLoadModule("/src/lib/game/cosmetics.ts");

after(async () => {
  await vite.close();
});

const cards = JSON.parse(readFileSync("/workspace/src/data/cards.json", "utf8"));
const cardList = cards.cards ?? cards;
const byId = new Set(cardList.map((c) => c.id));

function walkIds(obj, acc = []) {
  if (Array.isArray(obj)) {
    for (const x of obj) {
      if (typeof x === "string" && /^(reptilians|templars|illuminati|neutral)_/.test(x)) acc.push(x);
      else walkIds(x, acc);
    }
  } else if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) walkIds(v, acc);
  }
  return acc;
}

function fill(ids, n = 24) {
  const out = [...ids];
  while (out.length < n) out.push("templars_char_010");
  return out;
}

function drainAi(state) {
  let cur = state;
  let guard = 40;
  while (cur.phase === "ai" && !cur.winner && guard-- > 0) {
    cur = engine.applyAiAction(cur, engine.planAi(cur));
  }
  return cur;
}

function pass(state) {
  return drainAi(engine.endTurn(state));
}

const VAULT = [
  "templars_char_009", "templars_char_009", "templars_char_015", "templars_char_015",
  "templars_char_002", "templars_char_002", "templars_char_006", "templars_char_006",
  "templars_char_012", "templars_char_012", "templars_char_004", "templars_char_001",
  "templars_char_017", "templars_char_016", "templars_spell_003", "templars_spell_003",
  "templars_spell_001", "templars_spell_001", "templars_spell_004", "templars_spell_011",
  "templars_spell_012", "templars_spell_005", "templars_loc_001", "templars_loc_007",
  "neutral_char_007", "neutral_char_007", "neutral_char_022", "neutral_char_022",
  "neutral_spell_003", "neutral_spell_003",
];

const HIVE = [
  "reptilians_char_015", "reptilians_char_015", "reptilians_char_007", "reptilians_char_007",
  "reptilians_char_009", "reptilians_char_009", "reptilians_char_016", "reptilians_char_016",
  "reptilians_char_005", "reptilians_char_005", "reptilians_char_001", "reptilians_char_011",
  "reptilians_char_017", "reptilians_char_008", "reptilians_char_003", "reptilians_spell_011",
  "reptilians_spell_011", "reptilians_spell_001", "reptilians_spell_001", "reptilians_spell_009",
  "reptilians_spell_004", "reptilians_spell_012", "reptilians_spell_013", "neutral_spell_040",
  "reptilians_loc_007", "reptilians_loc_001", "neutral_char_006", "neutral_char_006",
  "neutral_char_002", "neutral_char_002",
];

describe("slice 9 reckless + crisis parity", () => {
  it("last_watch and abduct card ids exist", () => {
    const vault = JSON.parse(readFileSync("/workspace/src/data/campaign/templars/board_vault.json", "utf8"));
    const hive = JSON.parse(readFileSync("/workspace/src/data/campaign/reptilians/board_hive.json", "utf8"));
    const missing = [...new Set([...walkIds(vault), ...walkIds(hive)])].filter((id) => !byId.has(id));
    assert.deepEqual(missing, []);
    assert.ok(vault.nodes.some((n) => n.id === "last_watch" && n.type === "crisis"));
    assert.ok(hive.nodes.some((n) => n.id === "abduct" && n.type === "crisis"));
  });

  it("skip Vestry and skip Molt set distinct flags", () => {
    const walk = { id: "walk", label: "Keep walking", action: "skip" };
    const vestry = campaign.applySafehousePick(VAULT, walk, "vestry");
    assert.equal(vestry.flags.skipped_vestry, true);
    assert.equal(vestry.flags.skipped_safe_drop, undefined);
    assert.ok(vestry.ledgerExtra.includes("file_reckless"));
    const molt = campaign.applySafehousePick(HIVE, walk, "molt");
    assert.equal(molt.flags.skipped_molt, true);
    assert.equal(molt.flags.skipped_vestry, undefined);
    assert.ok(molt.ledgerExtra.includes("file_reckless"));
  });

  it("Crypt and Nest arrival swap to reckless panels", () => {
    const cryptBoard = campaign.getBoard("templars", "crypt");
    const nestBoard = campaign.getBoard("reptilians", "nest");
    const cryptNode = campaign.getNode(cryptBoard, "crypt_arrival");
    const nestNode = campaign.getNode(nestBoard, "nest_arrival");
    const cryptRun = { flags: { skipped_vestry: true }, difficulty: "normal" };
    const nestRun = { flags: { skipped_molt: true }, difficulty: "normal" };
    assert.match(campaign.storyPanelsFor(cryptRun, cryptNode)[0].text, /vestry was empty/i);
    assert.match(campaign.storyPanelsFor(nestRun, nestNode)[0].text, /molt was empty/i);
  });

  it("Last Watch is the only open vault node after Guardian", () => {
    const board = campaign.getBoard("templars", "vault");
    const run = {
      version: 1,
      chapterId: "templars",
      boardId: "vault",
      difficulty: "normal",
      phase: "forward",
      cleared: ["vault_intro", "nave_watch", "infirmary", "vestry", "crypt_rush", "inner_gate", "guardian"],
      reverseCleared: [],
      ledger: [],
      flags: { skipped_vestry: true },
      armoryPicks: [],
      deckId: "campaign_templars_vault_starter",
      deck: VAULT,
      deckLive: true,
      rewardsGranted: [],
      currentNodeId: null,
    };
    const open = board.nodes.filter((n) => campaign.nodeStatus(run, n, board) === "open").map((n) => n.id);
    assert.deepEqual(open, ["last_watch"]);
    const hive = campaign.getBoard("reptilians", "hive");
    const hiveRun = { ...run, chapterId: "reptilians", boardId: "hive", flags: { skipped_molt: true },
      cleared: ["hive_intro", "comb_watch", "psi_den", "molt", "static_field", "inner_comb", "slaver"] };
    const hiveOpen = hive.nodes.filter((n) => campaign.nodeStatus(hiveRun, n, hive) === "open").map((n) => n.id);
    assert.deepEqual(hiveOpen, ["abduct"]);
  });

  it("Last Watch launches as a 5-turn incense crisis", () => {
    const board = campaign.getBoard("templars", "vault");
    const node = campaign.getNode(board, "last_watch");
    const run = {
      version: 1,
      chapterId: "templars",
      boardId: "vault",
      difficulty: "normal",
      phase: "forward",
      cleared: ["vault_intro", "nave_watch", "infirmary", "vestry", "crypt_rush", "inner_gate", "guardian"],
      reverseCleared: [],
      ledger: [],
      flags: { skipped_vestry: true },
      armoryPicks: [],
      deckId: "campaign_templars_vault_starter",
      deck: VAULT,
      deckLive: true,
      rewardsGranted: [],
      currentNodeId: null,
    };
    const match = launch.matchFromCampaignNode(run, node, "Chaplain", board);
    assert.equal(match.crisis?.win, "survive_turns");
    assert.equal(match.crisis?.turnsRequired, 5);
    assert.match(match.crisis.label, /incense/i);
    assert.equal(match.ai.life, 18);
    assert.match(match.ai.name, /Incense/i);
  });

  it("Abduct launches as a 5-turn tractor crisis", () => {
    const board = campaign.getBoard("reptilians", "hive");
    const node = campaign.getNode(board, "abduct");
    const run = {
      version: 1,
      chapterId: "reptilians",
      boardId: "hive",
      difficulty: "normal",
      phase: "forward",
      cleared: ["hive_intro", "comb_watch", "psi_den", "molt", "static_field", "inner_comb", "slaver"],
      reverseCleared: [],
      ledger: [],
      flags: { skipped_molt: true },
      armoryPicks: [],
      deckId: "campaign_reptilians_hive_starter",
      deck: HIVE,
      deckLive: true,
      rewardsGranted: [],
      currentNodeId: null,
    };
    const match = launch.matchFromCampaignNode(run, node, "Voice", board);
    assert.equal(match.crisis?.win, "survive_turns");
    assert.equal(match.crisis?.turnsRequired, 5);
    assert.match(match.crisis.label, /tractor/i);
    assert.equal(match.ai.life, 18);
  });

  it("survive_turns awards the player after 5 of their turns", () => {
    let s = engine.startMatch({
      playerName: "Chaplain",
      aiName: "Incense Handler",
      playerFaction: "templars",
      aiFaction: "illuminati",
      playerDeck: fill(["templars_char_009", "templars_char_015"]),
      aiDeck: fill(["templars_char_010"]),
      skipMulligan: true,
      playerGoesFirst: true,
      shuffle: false,
      difficulty: "easy",
      encounterId: "last-watch-test",
      aiLife: 18,
      crisis: { win: "survive_turns", turnsRequired: 5, label: "Hold the incense" },
    });
    for (let i = 0; i < 5 && !s.winner; i++) {
      s.player.life = 30;
      s = pass(s);
    }
    assert.equal(s.winner, "player");
    assert.equal(s.crisis.turnsCompleted, 5);
    assert.match(s.log.join("\n"), /Hold the incense — you lasted 5 turns/i);
  });

  it("OATHBREAKER and SKINLESS unlock on the Reckless flags", () => {
    const oath = cosmetics.COSMETICS.find((c) => c.id === "title-oathbreaker");
    const skin = cosmetics.COSMETICS.find((c) => c.id === "title-skinless");
    assert.ok(oath);
    assert.ok(skin);
    const locked = {
      cityCleared: false, chapterCleared: false, heroicCleared: false, recklessCleared: false,
      vaultCleared: true, vaultHeroicCleared: false, vaultRecklessCleared: false,
      hiveCleared: true, hiveHeroicCleared: false, hiveRecklessCleared: false,
      cryptCleared: true, cryptHeroicCleared: false, nestCleared: true, nestHeroicCleared: false,
    };
    assert.equal(cosmetics.isCosmeticUnlocked(oath, locked), false);
    assert.equal(cosmetics.isCosmeticUnlocked(skin, locked), false);
    assert.equal(cosmetics.isCosmeticUnlocked(oath, { ...locked, vaultRecklessCleared: true }), true);
    assert.equal(cosmetics.isCosmeticUnlocked(skin, { ...locked, hiveRecklessCleared: true }), true);
  });
});
