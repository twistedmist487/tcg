import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const shotDir = join(root, "..", "tmp", "tutorial-verify");
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
  await page.screenshot({ path: join(shotDir, "01-menu.png"), fullPage: true });

  const menu = page.locator("#screen-menu");
  note(await menu.isVisible(), "Main menu is visible");
  note(await page.getByRole("button", { name: "Play Tutorial" }).isVisible(), "Play Tutorial button exists");
  note(await page.getByRole("button", { name: "Play vs AI" }).isVisible(), "Play vs AI button exists");
  note(await page.getByRole("button", { name: "Faction Encounters" }).isVisible(), "Encounters button exists");
  note(await page.getByRole("button", { name: "Deck Builder" }).isVisible(), "Deck Builder button exists");

  await page.getByRole("button", { name: "Play Tutorial" }).click();
  await page.waitForSelector("#screen-game:not([hidden])", { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(shotDir, "02-tutorial-start.png"), fullPage: true });

  const hint = page.locator("#tutorial-hint");
  note(await hint.isVisible(), "Tutorial hint panel is visible at start");
  const hintTitle = (await page.locator("#hint-title").innerText()).trim();
  const hintText = (await page.locator("#hint-text").innerText()).trim();
  note(hintTitle.length > 0, `Hint title: "${hintTitle}"`);
  note(/energy|squire|play card/i.test(`${hintTitle} ${hintText}`), `Hint teaches opening play: "${hintText}"`);

  const turnInfo = (await page.locator("#turn-info").innerText()).trim();
  note(/recruit/i.test(turnInfo), `It is the player's turn: "${turnInfo}"`);
  const energyText = await page.locator("#player-stats").innerText();
  note(/★\s*1\/1/.test(energyText), `First-turn energy is 1/1: "${energyText.replace(/\s+/g, " ")}"`);

  const squire = page.locator("#player-hand .card", { hasText: "Squire" }).first();
  note(await squire.isVisible(), "Squire is in the starting hand");

  await squire.click();
  await page.waitForTimeout(200);
  const playBtn = page.locator("#btn-play");
  note(await playBtn.isVisible(), "Play Card button is visible");
  note(await playBtn.isEnabled(), "Play Card is enabled after selecting Squire");
  await playBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(shotDir, "03-played-squire.png"), fullPage: true });

  const boardSquire = page.locator("#player-board .card", { hasText: "Squire" });
  note(await boardSquire.count() > 0, "Squire moved onto the board");
  note(await page.locator("#player-board", { hasText: "Exhausted" }).count() > 0, "Squire is Exhausted after play");

  const hintAfterPlay = (await page.locator("#hint-text").innerText()).trim();
  note(/exhaust|end turn/i.test(hintAfterPlay), `Hint advanced after play: "${hintAfterPlay}"`);

  const endBtn = page.locator("#btn-end-turn");
  note(await endBtn.isVisible(), "End Turn is visible");
  await endBtn.click();
  await page.waitForFunction(() => {
    const info = document.querySelector("#turn-info")?.innerText || "";
    const start = document.querySelector("#btn-start-turn");
    const startHidden = !start || start.style.display === "none";
    return /Recruit/i.test(info) && startHidden;
  }, { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shotDir, "04-after-ai.png"), fullPage: true });

  const afterAi = (await page.locator("#turn-info").innerText()).trim();
  note(/recruit/i.test(afterAi), `Turn returned to player after AI: "${afterAi}"`);

  const logText = await page.locator("#log").innerText();
  note(/AI plays|AI ends|The Recruiter/i.test(logText), `Log shows AI acted: ${JSON.stringify(logText.slice(0, 160))}`);

  const hintAfterAi = (await page.locator("#hint-text").innerText()).trim();
  note(/taunt|attack|combat|highlighted enemy/i.test(hintAfterAi), `Hint teaches combat/Taunt: "${hintAfterAi}"`);
  note(await page.locator("#opponent-board .card").count() > 0, "Recruiter has a character on the board");

  const ready = page.locator("#player-board .card").filter({ hasNotText: "Exhausted" });
  note(await ready.count() > 0, "Squire is ready to attack on turn 2");
  if (await ready.count()) {
    await ready.first().click();
    await page.waitForTimeout(200);
    const enemy = page.locator("#opponent-board .card").first();
    if (await enemy.count()) {
      await enemy.click();
      await page.waitForTimeout(800);
      const combatLog = await page.locator("#log").innerText();
      note(/attacks|slain|dmg/i.test(combatLog), `Combat resolved in the log: ${JSON.stringify(combatLog.split("\n")[0])}`);
    } else {
      note(false, "No enemy on board to attack");
    }
  }
  await page.screenshot({ path: join(shotDir, "05-combat.png"), fullPage: true });

  const hintCombat = (await page.locator("#hint-text").innerText().catch(() => "")).trim();
  note(
    /combat|taunt|spell|location|your move|attack/i.test(hintCombat) || !(await hint.isVisible()),
    `Post-combat hint: "${hintCombat || "(hidden/dismissed)"}"`,
  );

  note(!(await page.locator("#game-over").isVisible()), "Game is still in progress (not an instant loss)");
} catch (err) {
  note(false, `Script crashed: ${err.message}`);
  await page.screenshot({ path: join(shotDir, "99-error.png"), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const failed = findings.filter((f) => !f.ok);
console.log("\n---");
console.log(`${findings.length - failed.length}/${findings.length} checks passed`);
if (failed.length) process.exit(1);
