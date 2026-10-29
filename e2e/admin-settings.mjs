// Browser E2E for the admin shell and Settings (shipping + pincodes). Restores what it changes.
// Usage: ADMIN_URL=http://localhost:3001 node e2e/admin-settings.mjs
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
  const text = (t, timeout = 10000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
  const money = () => page.$$("input[inputmode=decimal]");
  const replace = async (el, v) => { await el.click(); await page.keyboard.press("End"); for (let i = 0; i < 12; i++) await page.keyboard.press("Backspace"); await el.type(v); };
  const saveShipping = async () => { await page.click("xpath/.//button[normalize-space()='Save shipping']"); await text("Shipping settings saved"); };

  await page.goto(`${ADMIN}/login`);
  await page.type("input[name=email]", process.env.OWNER_EMAIL ?? "owner@example.com");
  await page.type("input[name=password]", process.env.OWNER_PASSWORD ?? "ChangeMe!12345");
  await page.click("button[type=submit]");
  await text("Welcome");
  check(await page.$eval("nav[aria-label=Main]", (n) => ["catalog", "store", "account"].every((g) => n.innerText.toLowerCase().includes(g))), "sidebar is grouped (Catalog / Store / Account)");

  await page.click("a[href='/settings']");
  await page.waitForFunction(() => document.querySelectorAll("input[inputmode=decimal]").length === 2 && document.querySelector("input[inputmode=decimal]").value !== "");
  const [fee0, free0] = await page.$$eval("input[inputmode=decimal]", (i) => [i[0].value, i[1].value]);
  let [fee] = await money();
  await replace(fee, "55");
  await saveShipping();
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("input[inputmode=decimal]")?.value === "55");
  check(true, "shipping fee saves and persists across reload");
  [fee] = await money();
  await replace(fee, fee0);
  await saveShipping();
  check(true, `original fee ₹${fee0} (free above ₹${free0}) restored`);

  await page.waitForSelector("tbody tr");
  const pinForm = "form[aria-label='Add pincode']";
  await page.type(`${pinForm} input[maxlength='6']`, "999994");
  const rest = await page.$$(`${pinForm} input:not([maxlength='6'])`);
  await rest[0].type("E2E City"); await rest[1].type("DL");
  await page.click("xpath/.//button[normalize-space()='Add or update pincode']");
  await text("Pincode 999994 saved");
  await page.type("input[aria-label='Search pincodes']", "999994");
  await page.waitForFunction(() => document.querySelector("tbody")?.innerText.includes("E2E City"), { timeout: 10000 });
  check(true, "adding a pincode lists it (and search finds it)");

  await page.type("textarea", "12345,Bad,DL,yes,1,2");
  await page.click("xpath/.//button[normalize-space()='Import']");
  await page.waitForSelector("div[role=alert]");
  check(await page.$eval("div[role=alert]", (u) => u.innerText.includes("Line 1")), "CSV import reports the bad line instead of saving");

  await page.evaluate(axeSrc);
  const bad = (await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations)).filter((v) => ["critical", "serious"].includes(v.impact));
  check(bad.length === 0, `axe on Settings: no critical/serious violations${bad.length ? " → " + bad.map((v) => v.id + ":" + v.nodes[0]?.html.slice(0, 90)) : ""}`);

  await page.click("button[aria-label='Remove 999994']");
  await page.waitForSelector("dialog[open]");
  await page.click("dialog[open] button:last-child");
  await text("Pincode removed");
  await page.waitForFunction(() => !document.querySelector("tbody")?.innerText.includes("E2E City"), { timeout: 10000 });
  check(true, "removing a pincode asks to confirm, then removes it");

  await page.setViewport({ width: 390, height: 800 });
  await page.waitForSelector("button[aria-controls=admin-nav]");
  check(!(await page.$eval("#admin-nav", (n) => n.offsetParent !== null)), "mobile: nav is collapsed behind a Menu button");
  await page.click("button[aria-controls=admin-nav]");
  check(await page.$eval("#admin-nav", (n) => n.offsetParent !== null && n.innerText.includes("Sign out")), "mobile: Menu opens the nav with Sign out");
  check(errors.length === 0, `no page errors${errors.length ? " → " + errors : ""}`);
} catch (e) { failures.push(String(e)); console.log("  ✗", e.message); }
finally { await browser.close(); }
if (failures.length) { console.log(`\n${failures.length} failed`); process.exit(1); }
console.log("\nadmin settings e2e ok");
