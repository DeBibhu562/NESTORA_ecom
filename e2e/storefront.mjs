// Browser E2E for the public storefront. Needs: infra up, db migrated+seeded, API :4010, web storefront :3020 (production build), Chrome.
// Usage: pnpm e2e:store   (CHROME_PATH, STORE_URL override defaults)
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STORE = process.env.STORE_URL ?? "http://localhost:3020";
const OUT = mkdtempSync(join(tmpdir(), "store-e2e-"));
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const failures = [];
const step = (s) => console.log("•", s);
const check = (ok, msg) => { if (!ok) { failures.push(msg); console.log("  ✗", msg); } else console.log("  ✓", msg); };
const text = (page, t, timeout = 10000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const cards = (page) => page.$$eval("main article", (a) => a.length);
const marker = (page) => page.evaluate(() => (window.__nav = "alive"));
const alive = (page) => page.evaluate(() => window.__nav === "alive");

async function axe(page, name) {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.html.slice(0, 120) })));
  const bad = r.filter((v) => v.impact === "critical" || v.impact === "serious");
  check(bad.length === 0, `axe (${name}): no critical/serious violations${bad.length ? " → " + JSON.stringify(bad) : ""}`);
  if (r.length - bad.length) console.log("    minor/moderate:", r.filter((v) => !bad.includes(v)).map((v) => `${v.id}×${v.n}`).join(", "));
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
  // failed requests are tracked by URL so the deliberate invalid Notify-me submission (400) is the only allowed one
  page.on("response", (r) => { if (r.status() >= 400 && !(r.url().includes("/stock-alerts") && r.status() === 400)) consoleErrors.push(`${r.status()} ${r.url()}`); });

  step("home");
  await page.goto(STORE, { waitUntil: "networkidle0" });
  check((await page.title()).includes("Nestora"), "title contains brand");
  check(await page.$eval("header", (h) => h.innerText.includes("NESTORA")), "header shows Nestora logo");
  check((await cards(page)) >= 4, "bestsellers render");
  check(await page.$eval("main", (m) => /₹\d/.test(m.innerText)), "prices formatted in rupees");
  await page.screenshot({ path: join(OUT, "1-home.png") });
  await axe(page, "home");

  step("mega-menu opens on hover");
  const nav = await page.$("nav[aria-label=Categories] a");
  await nav.hover();
  await page.waitForFunction(() => [...document.querySelectorAll("nav[aria-label=Categories] a")].some((a) => a.textContent.includes("Vacuum Thermosteel") && getComputedStyle(a.parentElement).visibility === "visible"), { timeout: 3000 });
  check(true, "sub-categories visible");

  step("collection: 12 products, facets");
  await page.goto(`${STORE}/c/bottles`, { waitUntil: "networkidle0" });
  check((await cards(page)) === 12, "12 products listed");
  check(await page.$eval("h1", (h) => h.textContent === "Bottles & Flasks"), "h1 is category name");
  check(await page.$eval("body", (b) => b.innerText.includes("12 products")), "count shown");
  const meta = async () => page.evaluate(() => ({ robots: document.querySelector('meta[name=robots]')?.content, canon: document.querySelector('link[rel=canonical]')?.href }));
  let m = await meta();
  check(!/noindex/.test(m.robots ?? ""), "unfiltered page is indexable");
  check(m.canon?.endsWith("/c/bottles"), "canonical set");
  await axe(page, "collection");
  await page.screenshot({ path: join(OUT, "2-collection.png") });

  step("filter by material=Copper without a page reload");
  await marker(page);
  const [cb] = await page.$$("xpath/.//aside//label[.//span[normalize-space()='Copper']]//input");
  await cb.click();
  await page.waitForFunction(() => document.querySelectorAll("main article").length === 2, { timeout: 8000 });
  check(page.url().includes("material=Copper"), "URL reflects the filter");
  check(await alive(page), "no full page reload (client-side navigation)");
  check(await page.$eval("body", (b) => b.innerText.includes("2 products")), "count updates to 2");
  check(await page.$eval("main", (m) => m.innerText.includes("Material: Copper")), "active chip shown");
  await page.screenshot({ path: join(OUT, "3-filtered.png") });

  step("deep-link to a filtered URL renders identically (SSR)");
  await page.goto(`${STORE}/c/bottles?material=Copper`, { waitUntil: "networkidle0" });
  check((await cards(page)) === 2, "direct load shows the same 2 products");
  m = await meta();
  check(/noindex/.test(m.robots ?? ""), "filtered URL is noindex (server-rendered)");
  check(m.canon?.endsWith("/c/bottles"), "canonical of a filtered URL points at the unfiltered page");
  const [chip] = await page.$$("xpath/.//a[contains(., 'Clear all')]");
  await chip.click();
  await page.waitForFunction(() => document.querySelectorAll("main article").length === 12, { timeout: 8000 });
  check(true, "Clear all restores 12");

  step("sort by price ascending");
  await page.select("select", "price_asc");
  await page.waitForFunction(() => location.search.includes("price_asc"), { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 400));
  const prices = await page.$$eval("main article", (a) => a.map((x) => Number(x.querySelector(".text-brand")?.textContent.replace(/[^\d.]/g, ""))));
  check(prices.every((p, i) => i === 0 || p >= prices[i - 1]), `prices ascending (${prices.slice(0, 4).join(", ")}…)`);

  step("card swatch changes the image");
  await page.goto(`${STORE}/c/bottles/vacuum`, { waitUntil: "networkidle0" });
  const first = await page.$("main article");
  const before = await first.$eval("img", (i) => i.src);
  const sw = await first.$$("button[aria-label]");
  await sw[1].click();
  const after = await first.$eval("img", (i) => i.src);
  check(before !== after, "image switched on swatch click");

  step("PDP: variant switching, stock, URL");
  await page.goto(`${STORE}/p/aero-thermosteel-bottle`, { waitUntil: "networkidle0" });
  await marker(page);
  const priceText = () => page.$eval("[aria-atomic=true]", (p) => p.innerText.replace(/\s+/g, " "));
  const pick = (label) => page.click(`button[aria-label^="${label}"]`);
  await pick("550 ml"); await pick("Pink");
  let p1 = await priceText();
  check(/₹802/.test(p1) && /18% OFF/.test(p1), `550 ml / Pink → ₹802, 18% OFF (${p1})`);
  check(await page.$eval("main img[alt]", (i) => /Pink/.test(i.alt)), "gallery shows the Pink image");
  await pick("880 ml");
  const p2 = await priceText();
  check(/₹998/.test(p2) && p2 !== p1, `880 ml → ₹998 (${p2})`);
  check(page.url().includes("?variant=AER-880-PIN"), "URL carries the variant sku");
  check(await alive(page), "no page reload while switching");
  check(await page.$("button[aria-label='Ivory (sold out)']") !== null, "Ivory is marked sold out while 880 ml is selected");
  await pick("Ivory");
  await text(page, "Out of stock");
  check(await page.$("input[name=contact]") !== null, "Notify me form shown for sold-out combo");
  check(await page.$$eval("button", (bs) => bs.some((b) => /^Add to cart$/.test(b.textContent) )) === false, "Add to cart hidden when out of stock");
  await page.screenshot({ path: join(OUT, "4-pdp-soldout.png") });

  step("Notify me: validation then success");
  await page.type("input[name=contact]", "12345");
  await page.click("form button[type=submit]");
  await page.waitForSelector("[role=alert]", { timeout: 5000 });
  check(true, "invalid contact is rejected with a message");
  await page.$eval("input[name=contact]", (e) => { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.type("input[name=contact]", "e2e-notify@example.com");
  await page.click("form button[type=submit]");
  await text(page, "We'll let you know");
  check(true, "subscription confirmed");

  step("PDP: structured data, metadata, a11y, layout shift");
  await page.goto(`${STORE}/p/aero-thermosteel-bottle`, { waitUntil: "networkidle0" });
  const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)));
  const prod = ld.find((x) => x["@type"] === "Product");
  check(prod?.offers?.lowPrice === 802 && prod.offers.highPrice === 998 && prod.offers.priceCurrency === "INR", "Product JSON-LD offers 802–998 INR");
  check(ld.some((x) => x["@type"] === "BreadcrumbList"), "BreadcrumbList JSON-LD present");
  check((await meta()).canon?.endsWith("/p/aero-thermosteel-bottle"), "PDP canonical");
  await axe(page, "pdp");
  const cls = await page.evaluate(() => new Promise((res) => { let v = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: "layout-shift", buffered: true }); setTimeout(() => res(v), 1500); }));
  check(cls < 0.1, `CLS ${cls.toFixed(3)} < 0.1`);

  step("search: suggestions, keyboard, results page");
  await page.goto(STORE, { waitUntil: "networkidle0" });
  await page.type("header input[role=combobox]", "aer");
  await page.waitForSelector("[role=listbox] [role=option]", { timeout: 5000 });
  check(await page.$eval("[role=listbox]", (l) => l.innerText.includes("Aero Thermosteel Bottle")), "suggestion shown for 'aer'");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.pathname === "/p/aero-thermosteel-bottle", { timeout: 8000 });
  check(true, "Enter on a highlighted suggestion opens the product");
  await page.goto(`${STORE}/search?q=copper`, { waitUntil: "networkidle0" });
  check((await cards(page)) === 2 && (await page.$eval("h1", (h) => h.innerText.includes("copper"))), "search page: 2 results for 'copper'");
  check(/noindex/.test((await meta()).robots ?? ""), "search results are noindex");
  await page.goto(`${STORE}/search?q=zzzz`, { waitUntil: "networkidle0" });
  check(await page.$eval("body", (b) => b.innerText.includes("Nothing found")), "empty state for no results");

  step("mobile: filter sheet + PDP swipe-ready gallery");
  const mp = await browser.newPage();
  await mp.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mp.goto(`${STORE}/c/bottles`, { waitUntil: "load" });
  await mp.waitForSelector("main article");
  check(await mp.$eval("aside[aria-label=Filters]", (a) => getComputedStyle(a).display === "none"), "filters hidden by default on mobile");
  const [fb] = await mp.$$("xpath/.//button[starts-with(normalize-space(), 'Filters')]");
  await fb.tap();
  await mp.waitForFunction(() => getComputedStyle(document.querySelector("aside[aria-label=Filters]")).position === "fixed", { timeout: 3000 });
  await mp.screenshot({ path: join(OUT, "5-mobile-filters.png") });
  const [cb2] = await mp.$$("xpath/.//aside//label[.//span[normalize-space()='Glass']]//input");
  await cb2.tap();
  await mp.waitForFunction(() => /1 result/.test(document.body.innerText), { timeout: 8000 });
  const [show] = await mp.$$("xpath/.//button[starts-with(normalize-space(), 'Show')]");
  await show.tap();
  await mp.waitForFunction(() => getComputedStyle(document.querySelector("aside[aria-label=Filters]")).display === "none", { timeout: 3000 });
  check(true, "sheet applies filter and closes");
  check((await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)), "no horizontal overflow at 390px");
  await mp.goto(`${STORE}/p/aero-thermosteel-bottle`, { waitUntil: "load" });
  await mp.waitForSelector("main h1");
  check((await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)), "PDP: no horizontal overflow at 390px");
  await mp.screenshot({ path: join(OUT, "6-mobile-pdp.png") });

  check(consoleErrors.length === 0, `no console/page errors${consoleErrors.length ? ": " + consoleErrors.slice(0, 3).join(" | ") : ""}`);
} catch (e) {
  failures.push("crashed: " + e.message.split("\n")[0]);
  console.log("CRASH:", e.message.split("\n")[0]);
}
await browser.close();
console.log(failures.length ? `\nFAILED (${failures.length}):\n- ${failures.join("\n- ")}` : "\nSTOREFRONT E2E PASSED", "\nScreenshots:", OUT);
process.exit(failures.length ? 1 : 0);
