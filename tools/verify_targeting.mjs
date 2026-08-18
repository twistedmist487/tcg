import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const shotDir = join(root, "..", "tmp", "targeting-verify");
mkdirSync(shotDir, { recursive: true });

const findings = [];
function note(ok, msg) {
  findings.push({ ok, msg });
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });

  const spec = await page.evaluate(() => {
    const cards = {
      smite: { type: "Spell", effect: "Deal 4 damage to a target character." },
      consecration: { type: "Spell", effect: "Deal 1 damage to all enemy characters." },
      judgment: { type: "Spell", effect: "Deal 5 damage to an enemy character. Restore 5 Health to your hero." },
      absolution: { type: "Spell", effect: "Restore 5 Health to your hero or a character. Draw a card." },
      blessing: { type: "Spell", effect: "Give a friendly character +3 Attack and 'Can't be targeted by enemy abilities' until end of turn." },
      strike: { type: "Character", ability: "Assault: Deal 2 damage to a target character." },
      bag: { type: "Spell", effect: "Recycle. Deal 1 damage to the enemy hero." },
      star: { type: "Spell", effect: "Deal 2 damage to all enemy characters. Draw a card." },
    };
    const out = {};
    for (const [k, v] of Object.entries(cards)) out[k] = targetSpec(v).mode;
    return out;
  });
  note(spec.smite === "enemy", `Divine Smite target mode: ${spec.smite}`);
  note(spec.judgment === "enemy", `Judgment target mode: ${spec.judgment}`);
  note(spec.consecration === "none", `Consecration is untargeted AOE: ${spec.consecration}`);
  note(spec.star === "none", `Star Map is untargeted AOE: ${spec.star}`);
  note(spec.absolution === "ally_or_hero", `Absolution can hit hero or ally: ${spec.absolution}`);
  note(spec.blessing === "ally", `Friendly buff targets ally: ${spec.blessing}`);
  note(spec.strike === "enemy", `Strike Asset Assault targets enemy: ${spec.strike}`);
  note(spec.bag === "none", `Burn Bag does not ask for a character: ${spec.bag}`);

  await page.getByRole("button", { name: "Play Tutorial" }).click();
  await page.waitForSelector("#screen-game:not([hidden])", { timeout: 10000 });
  await page.waitForTimeout(600);

  const squire = page.locator("#player-hand .card", { hasText: "Squire" }).first();
  note(await squire.isVisible(), "Tutorial: Squire in hand");
  await squire.click();
  await page.locator("#control-panel #btn-play").click({ timeout: 5000 });
  await page.waitForTimeout(400);

  for (let i = 0; i < 6; i += 1) {
    const ready = await page.evaluate(() => {
      const me = getMyPlayer();
      const opp = getOpponent();
      const hasSmite = (me.hand || []).some((c) => c.name === "Divine Smite");
      const energy = me.energy || 0;
      const enemies = (opp.board || []).filter((c) => !c.stealth);
      return hasSmite && energy >= 4 && enemies.length > 0 && state.active_player === myPlayerName && state.turn_started;
    });
    if (ready) break;
    const end = page.locator("#btn-end-turn");
    if (await end.isVisible()) await end.click();
    await page.waitForFunction(() => {
      const info = document.querySelector("#turn-info")?.innerText || "";
      const play = document.querySelector("#btn-play");
      return /Recruit/i.test(info) && play && play.style.display !== "none";
    }, { timeout: 20000 });
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: join(shotDir, "01-ready-to-smite.png"), fullPage: true });

  const smite = page.locator("#player-hand .card", { hasText: "Divine Smite" }).first();
  if (await smite.count()) {
    await smite.click();
    await page.waitForTimeout(250);
    const prompt = await page.locator("#btn-play").innerText();
    note(/click a target/i.test(prompt), `Selecting Smite arms targeting: "${prompt}"`);
    const highlighted = page.locator("#opponent-board .card.targetable");
    note((await highlighted.count()) > 0, "Enemy is highlighted as a spell target");
    await page.screenshot({ path: join(shotDir, "02-smite-targeting.png"), fullPage: true });
    const before = await page.locator("#opponent-board").innerText();
    await highlighted.first().click();
    await page.waitForTimeout(500);
    const log = await page.locator("#log").innerText();
    note(/Played Divine Smite/i.test(log), "Divine Smite resolved after clicking the enemy");
    const after = await page.locator("#opponent-board").innerText();
    note(before !== after || /empty/i.test(after) || !after.includes("Hatchling"), `Enemy board changed after Smite`);
    await page.screenshot({ path: join(shotDir, "03-smite-resolved.png"), fullPage: true });
  } else {
    note(false, "Divine Smite was not in hand on turn 2");
  }

  const live = await page.evaluate(async () => {
    const payload = {
      player_name: "Tester",
      player_faction: "templars",
      ai_faction: "illuminati",
      difficulty: "easy",
      mode: "standard",
      player_deck: [
        { id: "templars_char_009", copies: 3 },
        { id: "templars_spell_001", copies: 3 },
        { id: "templars_spell_003", copies: 3 },
        { id: "templars_spell_004", copies: 3 },
        { id: "templars_spell_006", copies: 3 },
        { id: "templars_spell_008", copies: 3 },
        { id: "neutral_char_012", copies: 3 },
        { id: "templars_char_001", copies: 3 },
        { id: "templars_char_002", copies: 3 },
        { id: "templars_char_006", copies: 3 },
      ],
    };
    const data = await api("POST", "/api/game/new", payload);
    const sid = data.session_id;
    let state = data.state;
    if (!state.turn_started) {
      const started = await api("POST", `/api/game/${sid}/start-turn`);
      state = started.state || started;
    }
    const me = state.players.find((p) => p.name === "Tester") || state.players[0];
    const opp = state.players.find((p) => p.name !== me.name);
    const play = async (id, extra = "") => {
      const idx = me.hand.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false, err: "not in hand" };
      const res = await api("POST", `/api/game/${sid}/play?card_index=${idx}${extra}`);
      state = res.state;
      return res.action_result;
    };
    return { sid, energy: me.energy, hand: (me.hand || []).map((c) => c.name), oppBoard: (opp.board || []).length };
  });
  note(true, `API session energy ${live.energy}, hand ${live.hand.join(", ") || "(empty)"}`);

} catch (err) {
  console.log("ERROR", err);
  note(false, String(err));
} finally {
  const failed = findings.filter((f) => !f.ok).length;
  console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
