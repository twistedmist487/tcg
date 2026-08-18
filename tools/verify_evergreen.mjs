import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const shotDir = join(root, "..", "tmp", "evergreen-verify");
mkdirSync(shotDir, { recursive: true });

const findings = [];
function note(ok, msg) {
  findings.push({ ok, msg });
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "How to Play" }).click();
  await page.waitForSelector("#screen-help:not([hidden])");
  const help = await page.locator("#screen-help").innerText();
  note(/Drain/.test(help) && /Recycle/.test(help) && /Ward/.test(help), "How to Play lists new keywords");
  await page.screenshot({ path: join(shotDir, "01-help.png"), fullPage: true });
  await page.getByRole("button", { name: "Back" }).click();

  await page.getByRole("button", { name: "Deck Builder" }).click();
  await page.waitForSelector("#screen-deck:not([hidden])");
  await page.selectOption("#deck-keyword", "Recycle");
  await page.waitForTimeout(200);
  const collection = await page.locator("#deck-collection").innerText();
  note(/Burn Bag/.test(collection), "Deck builder Recycle filter shows Burn Bag");
  note(/Recycle/.test(collection), "Burn Bag shows a Recycle tag");
  await page.screenshot({ path: join(shotDir, "02-deck-recycle.png"), fullPage: true });
  await page.selectOption("#deck-keyword", "Split");
  await page.waitForTimeout(200);
  note(/Forked Brief/.test(await page.locator("#deck-collection").innerText()), "Split filter shows Forked Brief");

  const seeded = await page.evaluate(async () => {
    const payload = {
      player_name: "Tester",
      player_faction: "templars",
      ai_faction: "illuminati",
      difficulty: "easy",
      mode: "standard",
      player_deck: [
        { id: "templars_char_001", copies: 3 },
        { id: "templars_char_002", copies: 3 },
        { id: "templars_char_003", copies: 3 },
        { id: "templars_char_004", copies: 3 },
        { id: "templars_char_005", copies: 3 },
        { id: "templars_char_006", copies: 3 },
        { id: "templars_char_007", copies: 3 },
        { id: "templars_char_008", copies: 3 },
        { id: "neutral_spell_007", copies: 3 },
        { id: "neutral_spell_008", copies: 3 },
      ],
    };
    let names = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await beginMatch(payload, { skipMulligan: true });
      const me = getMyPlayer();
      names = ((me && me.hand) || []).map((c) => c.name);
      if (names.includes("Burn Bag") && names.includes("Forked Brief")) {
        return names;
      }
    }
    return names;
  });
  await page.waitForSelector("#screen-game:not([hidden])", { timeout: 10000 });
  await page.waitForTimeout(400);
  note(seeded.includes("Burn Bag") && seeded.includes("Forked Brief"), `Server hand: ${seeded.join(", ")}`);

  async function playSplitIfPresent() {
    const brief = page.locator("#player-hand .card", { hasText: "Forked Brief" }).first();
    if (!(await brief.count())) return false;
    await brief.click();
    await page.waitForTimeout(150);
    const play = page.locator("#btn-play");
    if (!(await play.isEnabled())) return false;
    await play.click();
    await page.waitForSelector("#split-overlay:not([hidden])", { timeout: 8000 });
    note(true, "Split overlay opened after playing Forked Brief");
    const drawOpt = page.locator("#split-choices button", { hasText: "Draw a card" });
    note(await drawOpt.isVisible(), "Split offers Draw a card");
    await page.screenshot({ path: join(shotDir, "04-split.png"), fullPage: true });
    await drawOpt.click();
    await page.waitForTimeout(400);
    note(await page.locator("#split-overlay").isHidden(), "Split overlay closes after a choice");
    const log = await page.locator("#log").innerText();
    note(/Split: Draw a card/i.test(log), "Split choice is logged");
    return true;
  }

  async function recycleIfPresent() {
    const bag = page.locator("#player-hand .card", { hasText: "Burn Bag" }).first();
    if (!(await bag.count())) return false;
    await bag.click();
    await page.waitForTimeout(200);
    const recycle = page.locator("#btn-recycle");
    note(await recycle.isVisible(), "Recycle button appears for Burn Bag");
    if (!(await recycle.isEnabled())) return false;
    await recycle.click();
    await page.waitForTimeout(400);
    const log = await page.locator("#log").innerText();
    note(/Recycled Burn Bag/i.test(log), "Recycle logged Burn Bag");
    await page.screenshot({ path: join(shotDir, "03-recycle.png"), fullPage: true });
    return true;
  }

  const energyText = await page.locator("#player-stats").innerText();
  const energy = Number((energyText.match(/★\s*(\d+)/) || [])[1] || 0);
  if (energy >= 2) {
    if (!(await playSplitIfPresent())) note(false, "Could not play Forked Brief on this turn");
    await recycleIfPresent();
  } else {
    await recycleIfPresent();
  }

  if (!(await page.locator("#log").innerText().then((t) => /Split: Draw a card/i.test(t)))) {
    const turnBefore = await page.locator("#turn-info").innerText();
    await page.locator("#btn-end-turn").click();
    await page.waitForFunction((prev) => {
      const info = document.querySelector("#turn-info")?.innerText || "";
      const play = document.querySelector("#btn-play");
      return info !== prev && /Tester/i.test(info) && play && play.style.display !== "none";
    }, turnBefore, { timeout: 20000 });
    await page.waitForTimeout(400);
    if (!(await playSplitIfPresent())) note(false, "Forked Brief was not playable after the next turn");
  }

  await page.screenshot({ path: join(shotDir, "05-after.png"), fullPage: true });
} catch (err) {
  console.log("ERROR", err);
  note(false, String(err));
} finally {
  const failed = findings.filter((f) => !f.ok).length;
  console.log(`\n${findings.length - failed}/${findings.length} checks passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
