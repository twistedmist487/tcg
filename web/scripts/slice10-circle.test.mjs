import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
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

const PROGRESS = {
  cityCleared: true,
  chapterCleared: true,
  heroicCleared: false,
  recklessCleared: false,
  vaultCleared: true,
  vaultHeroicCleared: false,
  vaultRecklessCleared: false,
  hiveCleared: true,
  hiveHeroicCleared: false,
  hiveRecklessCleared: false,
  cryptCleared: true,
  cryptHeroicCleared: false,
  nestCleared: true,
  nestHeroicCleared: false,
  circleCleared: false,
};

describe("slice 10 The Circle Closes", () => {
  it("circle JSON card ids exist and the board is four nodes", () => {
    const board = JSON.parse(readFileSync("/workspace/src/data/campaign/circle/board_circle.json", "utf8"));
    const missing = [...new Set(walkIds(board))].filter((id) => !byId.has(id));
    assert.deepEqual(missing, []);
    assert.equal(board.id, "circle");
    assert.equal(board.start_node, "circle_arrival");
    const ids = board.nodes.map((n) => n.id);
    assert.deepEqual(ids, ["circle_arrival", "hired_guns", "tri_armory", "the_archive"]);
    const hired = board.nodes.find((n) => n.id === "hired_guns");
    const archive = board.nodes.find((n) => n.id === "the_archive");
    const piles = board.nodes.find((n) => n.id === "tri_armory");
    assert.equal(hired.type, "combat");
    assert.equal(hired.teach, false);
    assert.equal(hired.player_deck_mode, "run");
    assert.equal(hired.ai_starting_life, 16);
    assert.equal(hired.ai_deck.length, 30);
    assert.equal(archive.type, "boss");
    assert.equal(archive.teach, false);
    assert.equal(archive.ai_starting_life, 30);
    assert.equal(archive.ai_deck.length, 30);
    assert.equal(archive.twist?.id, "black_room");
    assert.equal(archive.twist?.match_modifiers?.reveal_top_card, true);
    assert.equal(archive.coach, "silent");
    assert.equal(piles.type, "safehouse");
    const picks = piles.safehouse.pick_one_of.map((p) => p.id);
    assert.deepEqual(picks, ["illuminati_char_005", "templars_char_007", "reptilians_char_018"]);
  });

  it("index lists circle as a sealed archive capstone", () => {
    const index = JSON.parse(readFileSync("/workspace/src/data/campaign/index.json", "utf8"));
    const ch = index.chapters.find((c) => c.id === "circle");
    assert.ok(ch);
    assert.equal(ch.faction, "archive");
    assert.equal(ch.status, "sealed");
    assert.equal(ch.starter_board, "circle");
    const loaded = campaign.loadChapter("circle");
    assert.ok(loaded);
    assert.deepEqual(loaded.boards, ["circle"]);
    assert.ok(loaded.board_data.circle);
  });

  it("new circle run is live with the picked kit", () => {
    const lodge = campaign.newCampaignRun("circle", "normal", { kitFaction: "illuminati" });
    assert.equal(lodge.chapterId, "circle");
    assert.equal(lodge.boardId, "circle");
    assert.equal(lodge.deckLive, true);
    assert.equal(lodge.flags.kit_faction, "illuminati");
    assert.equal(lodge.deckId, "campaign_illuminati_city_starter");
    assert.equal(lodge.deck.length, 30);

    const faith = campaign.newCampaignRun("circle", "heroic", { kitFaction: "templars" });
    assert.equal(faith.flags.kit_faction, "templars");
    assert.equal(faith.deckId, "campaign_templars_vault_starter");
    assert.equal(faith.difficulty, "heroic");

    const comb = campaign.newCampaignRun("circle", "normal", { kitFaction: "reptilians" });
    assert.equal(comb.flags.kit_faction, "reptilians");
    assert.equal(comb.deckId, "campaign_reptilians_hive_starter");
  });

  it("Hired Guns launches as a 16-life no-teach test", () => {
    const board = campaign.getBoard("circle", "circle");
    const node = campaign.getNode(board, "hired_guns");
    const run = campaign.newCampaignRun("circle", "normal", { kitFaction: "illuminati" });
    const match = launch.matchFromCampaignNode(run, node, "ARCHIVE_7", board);
    assert.equal(match.ai.life, 16);
    assert.match(match.ai.name, /Courier/i);
    assert.equal(match.player.faction, "illuminati");
    assert.equal(match.campaign.teach, false);
    assert.equal(match.campaign.coach, "ops");
    assert.equal(match.twist, null);
    assert.equal(match.player.deck.length + match.player.hand.length, 30);
  });

  it("The Archive is 30 life, silent, Black Room revealTop", () => {
    const board = campaign.getBoard("circle", "circle");
    const node = campaign.getNode(board, "the_archive");
    const run = campaign.newCampaignRun("circle", "normal", { kitFaction: "templars" });
    const match = launch.matchFromCampaignNode(run, node, "ARCHIVE_7", board);
    assert.equal(match.ai.life, 30);
    assert.equal(match.ai.name, "The Archive");
    assert.equal(match.player.faction, "templars");
    assert.equal(match.campaign.coach, "silent");
    assert.equal(match.campaign.teach, false);
    assert.equal(match.twist?.id, "black_room");
    assert.equal(match.twist?.revealTop, true);
    assert.match(match.twist.label, /Black Room/i);
    assert.ok(match.player.deck[0] || match.player.hand[0]);

    const heroic = campaign.newCampaignRun("circle", "heroic", { kitFaction: "reptilians" });
    const hard = launch.matchFromCampaignNode(heroic, node, "ARCHIVE_7", board);
    assert.equal(hard.ai.life, 32);
    assert.equal(hard.player.faction, "reptilians");
    assert.equal(hard.twist?.revealTop, true);
  });

  it("Three Piles adds one field card and stays at 30", () => {
    const run = campaign.newCampaignRun("circle", "normal", { kitFaction: "illuminati" });
    const pick = {
      id: "illuminati_char_005",
      label: "Lodge pile",
      blurb: "Puppet Master",
      action: "add",
      copies: 1,
      trim: ["neutral_char_028", "neutral_spell_022", "neutral_char_001"],
    };
    const applied = campaign.applySafehousePick(run.deck, pick, "tri_armory");
    assert.ok(applied.deck.includes("illuminati_char_005"));
    assert.equal(applied.deck.length, 30);
    assert.equal(applied.flags.last_armory_pick, "Lodge pile");
  });

  it("clearing the Archive closes the circle", () => {
    const board = campaign.getBoard("circle", "circle");
    const node = campaign.getNode(board, "the_archive");
    const run = campaign.newCampaignRun("circle", "normal", { kitFaction: "illuminati" });
    run.cleared = ["circle_arrival", "hired_guns", "tri_armory"];
    const next = campaign.applyNodeClear(run, node, board);
    assert.equal(next.flags.circle_chapter_complete, true);
    assert.equal(next.flags.board_circle_complete, true);
    assert.equal(next.phase, "done");
    assert.equal(campaign.NODE_FIRST_CLEAR.the_archive.credits, 250);
    assert.deepEqual(campaign.NODE_FIRST_CLEAR.the_archive.cards, []);
  });

  it("Circle Felt and ARCHIVE_WALKER unlock on circleCleared", () => {
    const felt = cosmetics.COSMETICS.find((c) => c.id === "felt-circle");
    const title = cosmetics.COSMETICS.find((c) => c.id === "title-archive-walker");
    assert.ok(felt);
    assert.ok(title);
    assert.equal(felt.unlock, "circle");
    assert.equal(title.unlock, "circle");
    assert.equal(title.name, "ARCHIVE_WALKER");
    assert.equal(cosmetics.isCosmeticUnlocked(felt, PROGRESS), false);
    assert.equal(cosmetics.isCosmeticUnlocked(title, PROGRESS), false);
    assert.equal(cosmetics.isCosmeticUnlocked(felt, { ...PROGRESS, circleCleared: true }), true);
    assert.equal(cosmetics.isCosmeticUnlocked(title, { ...PROGRESS, circleCleared: true }), true);
  });
});
