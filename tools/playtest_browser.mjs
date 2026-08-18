import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const shotDir = join(root, "..", "tmp", "playtest-live");
mkdirSync(shotDir, { recursive: true });

const findings = [];
function note(ok, msg) {
  findings.push({ ok, msg });
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
}

const pageErrors = [];
const httpErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (err) => {
  pageErrors.push(err.message);
  console.log("PAGEERROR", err.message);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});
page.on("response", (resp) => {
  if (resp.url().includes("/api/") && resp.status() >= 400) {
    httpErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
  }
});

async function myTurnReady() {
  return page.waitForFunction(() => {
    if (!state || state.is_over) return true;
    const play = document.querySelector("#btn-play");
    const start = document.querySelector("#btn-start-turn");
    const info = document.querySelector("#turn-info")?.innerText || "";
    const mine = typeof myPlayerName === "string" && info.includes(myPlayerName);
    const canAct = play && play.style.display !== "none";
    const needStart = start && start.style.display !== "none";
    return mine && (canAct || needStart);
  }, { timeout: 25000 });
}

async function playAffordableOrEnd(label) {
  await myTurnReady();
  if (await page.evaluate(() => !!(state && state.is_over))) return "over";
  const started = await page.evaluate(() => {
    const start = document.querySelector("#btn-start-turn");
    return !start || start.style.display === "none";
  });
  if (!started) {
    await page.locator("#btn-start-turn").click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  const acted = await page.evaluate(async () => {
    const me = getMyPlayer();
    const opp = getOpponent();
    if (!me || !state.turn_started) return "wait";
    const idx = (me.hand || []).findIndex((c) => (c.cost || 0) <= (me.energy || 0) && c.type !== "Spell");
    if (idx >= 0) {
      selectedCardIndex = idx;
      await playSelectedCard(null, "enemy");
      return "played";
    }
    const ready = (me.board || []).findIndex((c) => c.attack > 0 && !c.exhausted && !c.stasis);
    if (ready >= 0) {
      const face = !(opp.board || []).some((c) => !c.stealth);
      const taunt = (opp.board || []).findIndex((c) => c.taunt && !c.stealth);
      const target = face ? null : (taunt >= 0 ? taunt : 0);
      await sendAttack(ready, target);
      return "attacked";
    }
    return "end";
  });
  if (acted === "end" || acted === "wait") {
    const end = page.locator("#btn-end-turn");
    if (await end.isVisible()) {
      await end.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  return acted;
}

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Play Tutorial" }).click();
  await page.waitForSelector("#screen-game:not([hidden])", { timeout: 10000 });
  await page.waitForTimeout(500);
  note(true, "Tutorial started");

  for (let i = 0; i < 10; i += 1) {
    if (await page.evaluate(() => !!(state && state.is_over))) break;
    await playAffordableOrEnd(`tutorial-${i}`);
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: join(shotDir, "01-tutorial.png"), fullPage: true });
  const tutState = await page.evaluate(() => ({
    over: !!(state && state.is_over),
    turn: state && state.turn,
    log: (document.querySelector("#log")?.innerText || "").slice(0, 240),
    winner: state && state.winner,
  }));
  note(!pageErrors.length, `Tutorial page errors: ${pageErrors.length ? pageErrors.join(" | ") : "none"}`);
  note(!httpErrors.length, `Tutorial HTTP errors: ${httpErrors.length ? httpErrors.join(" | ") : "none"}`);
  note(true, `Tutorial after 10 actions: turn=${tutState.turn} over=${tutState.over} winner=${tutState.winner}`);

  await page.evaluate(() => returnToMenu(true));
  await page.waitForSelector("#screen-menu:not([hidden])");

  const matchups = [
    { player: "templars", ai: "reptilians", pdeck: "test_templar_aggro", aideck: "test_reptilian_swarm", name: "Charge vs Swarm" },
    { player: "illuminati", ai: "templars", pdeck: "test_illuminati_control", aideck: "test_templar_control", name: "Denial vs Walls" },
    { player: "templars", ai: "reptilians", pdeck: "test_network_lab", aideck: "test_reptilian_swarm", name: "Network Lab vs Swarm" },
  ];

  for (const m of matchups) {
    pageErrors.length = 0;
    httpErrors.length = 0;
    const started = await page.evaluate(async (cfg) => {
      const payload = {
        player_name: "Tester",
        player_faction: cfg.player,
        ai_faction: cfg.ai,
        difficulty: "easy",
        mode: "standard",
        player_deck_id: cfg.pdeck,
        ai_deck_id: cfg.aideck,
      };
      try {
        await beginMatch(payload, { skipMulligan: true });
        return { ok: true, turn: state && state.turn, players: (state.players || []).map((p) => p.name) };
      } catch (e) {
        return { ok: false, err: String(e) };
      }
    }, m);
    note(started.ok, `${m.name} started: ${started.ok ? `turn ${started.turn}` : started.err}`);
    if (!started.ok) continue;
    await page.waitForSelector("#screen-game:not([hidden])", { timeout: 8000 }).catch(() => {});
    for (let i = 0; i < 12; i += 1) {
      if (await page.evaluate(() => !!(state && state.is_over))) break;
      await playAffordableOrEnd(`${m.name}-${i}`);
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: join(shotDir, `${m.pdeck}.png`), fullPage: true });
    const snap = await page.evaluate(() => ({
      over: !!(state && state.is_over),
      turn: state && state.turn,
      winner: state && state.winner,
      log: (document.querySelector("#log")?.innerText || "").split("\n").slice(0, 6),
    }));
    note(!pageErrors.length, `${m.name} page errors: ${pageErrors.length ? pageErrors.join(" | ") : "none"}`);
    note(!httpErrors.length, `${m.name} HTTP errors: ${httpErrors.length ? httpErrors.join(" | ") : "none"}`);
    note(true, `${m.name} after play: turn=${snap.turn} over=${snap.over} winner=${snap.winner}`);
    await page.evaluate(() => returnToMenu(true));
  }
} catch (err) {
  console.log("ERROR", err);
  note(false, String(err));
} finally {
  const failed = findings.filter((f) => !f.ok).length;
  console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
