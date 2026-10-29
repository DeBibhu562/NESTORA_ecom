// Browser E2E for the cart drawer. Needs the API (with /cart) and the storefront running, plus Chrome.
// Usage: STORE_URL=http://localhost:3020 node e2e/cart.mjs   (CHROME_PATH overrides the browser)
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const STORE = process.env.STORE_URL ?? "http://localhost:3020";
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const failures = [];
const check = (ok, msg) => { console.log(ok ? "  ✓" : "  ✗", msg); if (!ok) failures.push(msg); };
const text = (page, t, timeout = 10000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${STORE}/c/bottles`, { waitUntil: "networkidle0" });
  const href = await page.$eval("main article a[href^='/p/']", (a) => a.getAttribute("href"));
  await page.goto(`${STORE}${href}`, { waitUntil: "networkidle0" });

  await page.click("button ::-p-text(Add to cart)");
  await page.waitForSelector("dialog[open]");
  check(await page.$eval("dialog[open]", (d) => d.innerText.includes("Subtotal")), "drawer opens with a priced cart after Add to cart");
  check((await page.$eval("button[aria-label^='Open cart']", (b) => b.getAttribute("aria-label"))).includes("1 item"), "header badge shows 1 item");

  const total1 = await page.$eval("dialog[open]", (d) => d.innerText.match(/Total[^₹]*₹[\d,.]+/)?.[0]);
  await page.click("dialog[open] button[aria-label*='ncrease'], dialog[open] button ::-p-text(+)");
  await page.waitForFunction((t) => !document.querySelector("dialog[open]").innerText.includes(t), { timeout: 8000 }, total1);
  check(true, "quantity + re-prices the total on the server");

  await page.type("dialog[open] input[aria-label='Coupon code']", "DIWALI15");
  await page.click("dialog[open] button ::-p-text(Apply)");
  await text(page, "DIWALI15 applied");
  check(true, "coupon DIWALI15 applies");

  await page.evaluate(axeSrc);
  const bad = (await page.evaluate(async () => (await window.axe.run(document.querySelector("dialog[open]"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations)).filter((v) => ["critical", "serious"].includes(v.impact));
  check(bad.length === 0, `axe on the drawer: no critical/serious violations${bad.length ? " → " + bad.map((v) => v.id) : ""}`);

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  check(true, "Escape closes the drawer");

  await page.reload({ waitUntil: "networkidle0" });
  check((await page.$eval("button[aria-label^='Open cart']", (b) => b.getAttribute("aria-label"))).includes("2 items"), "cart persists across reload (cookie)");

  await page.click("button[aria-label^='Open cart']");
  await page.waitForSelector("dialog[open]");
  while (await page.$("dialog[open] button ::-p-text(Remove)")) { await page.click("dialog[open] button ::-p-text(Remove)"); await new Promise((r) => setTimeout(r, 400)); }
  await text(page, "Your cart is empty");
  check(true, "removing all items shows the empty state");
  check(errors.length === 0, `no page errors or failed requests${errors.length ? " → " + errors.join(" | ") : ""}`);
} catch (e) { failures.push(String(e)); console.log("  ✗", e.message); }
finally { await browser.close(); }
if (failures.length) { console.log(`\n${failures.length} failed`); process.exit(1); }
console.log("\ncart e2e ok");
