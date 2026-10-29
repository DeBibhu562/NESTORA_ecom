// Browser E2E for admin product management (select, bulk bar, duplicate, delete confirm, a11y). Self-cleaning.
// Needs: API with this release, admin, Chrome. Usage: ADMIN_URL=http://localhost:3001 node e2e/admin-products.mjs
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const failures = [];
const check = (ok, msg) => { console.log(ok ? "  ✓" : "  ✗", msg); if (!ok) failures.push(msg); };

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const text = (t, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);

  await page.goto(`${ADMIN}/login`);
  await page.type("input[name=email]", process.env.OWNER_EMAIL ?? "owner@example.com");
  await page.type("input[name=password]", process.env.OWNER_PASSWORD ?? "ChangeMe!12345");
  await page.click("button[type=submit]");
  await text("Welcome");

  await page.goto(`${ADMIN}/products`);
  await page.waitForSelector("tbody input[type=checkbox]");
  check(await page.$eval("h1", (h) => /\d+ total/.test(h.innerText)), "list shows the total count");

  await page.click("tbody tr:nth-child(1) input[type=checkbox]");
  await page.click("tbody tr:nth-child(2) input[type=checkbox]");
  check(await page.$eval("[aria-label='Bulk actions']", (b) => b.innerText.includes("2 selected")), "selecting rows shows the bulk bar");
  await page.click("[aria-label='Bulk actions'] button:last-child"); // Clear
  check(!(await page.$("[aria-label='Bulk actions']")), "Clear hides the bulk bar");

  await page.type("input[aria-label='Search products']", "Pro Gym");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1 && document.querySelector("tbody")?.innerText.includes("Pro Gym"));
  await page.click("button[aria-label^='Duplicate']");
  await page.waitForFunction(() => document.querySelector("h1")?.innerText.includes("(Copy)"), { timeout: 15000 });
  check(true, "duplicate creates a draft copy and opens its editor");
  check(await page.$eval("body", (b) => b.innerText.includes("DRAFT")), "the copy is a draft");

  await page.evaluate(axeSrc);
  const bad = (await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations)).filter((v) => ["critical", "serious"].includes(v.impact));
  check(bad.length === 0, `axe on editor: no critical/serious violations${bad.length ? " → " + bad.map((v) => v.id + ":" + v.nodes[0]?.html.slice(0, 100)) : ""}`);

  await page.click("xpath/.//button[normalize-space()='Delete']");
  await page.waitForSelector("dialog[open]");
  check(await page.$eval("dialog[open]", (d) => d.innerText.includes("(Copy)")), "delete asks for confirmation naming the product");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  check(page.url().includes("/products/"), "Escape cancels the delete");
  await page.click("xpath/.//button[normalize-space()='Delete']");
  await page.waitForSelector("dialog[open]");
  await page.click("dialog[open] button:last-child");
  await page.waitForFunction(() => location.pathname === "/products");
  await page.type("input[aria-label='Search products']", "(Copy)");
  await page.waitForFunction(() => document.body.innerText.includes("No products match"), { timeout: 10000 });
  check(true, "confirmed delete removes the copy from the normal list");

  await page.select("select[aria-label='Status']", "DELETED");
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("(Copy)"), { timeout: 10000 });
  check(true, "Deleted filter lists the soft-deleted copy");
  await page.click("button[aria-label^='Restore']");
  await page.waitForFunction(() => document.body.innerText.includes("restored as Archived"), { timeout: 10000 });
  await page.select("select[aria-label='Status']", "ARCHIVED");
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("(Copy)"), { timeout: 10000 });
  check(true, "Restore brings it back as ARCHIVED (never live)");

  await page.click("button[aria-label^='Delete']"); // tidy up: delete the copy again
  await page.waitForSelector("dialog[open]");
  await page.click("dialog[open] button:last-child");
  await page.waitForFunction(() => document.body.innerText.includes("No products match"), { timeout: 10000 });
  check(errors.length === 0, `no page errors${errors.length ? " → " + errors : ""}`);
} catch (e) { failures.push(String(e)); console.log("  ✗", e.message); }
finally { await browser.close(); }
if (failures.length) { console.log(`\n${failures.length} failed`); process.exit(1); }
console.log("\nadmin products e2e ok");
