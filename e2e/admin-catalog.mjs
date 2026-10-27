// Browser E2E for the admin catalog flow. Needs: infra up, db migrated+seeded, API on :4010, admin on :3001, Chrome installed.
// Usage: pnpm e2e   (override with CHROME_PATH, ADMIN_URL, API_URL, OWNER_EMAIL, OWNER_PASSWORD)
import puppeteer from "puppeteer-core";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = mkdtempSync(join(tmpdir(), "admin-e2e-"));
const PNG = join(OUT, "t.png");
writeFileSync(PNG, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
const API_URL = process.env.API_URL ?? "http://localhost:4010";
const EMAIL = process.env.OWNER_EMAIL ?? "owner@example.com";
const PASSWORD = process.env.OWNER_PASSWORD ?? "ChangeMe!12345";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const tag = Date.now().toString(36);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900 });
const problems = [];
let productId = null;
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|401/.test(m.text())) problems.push("console: " + m.text()); });
page.on("response", (r) => { if (r.status() === 404) console.log("  404:", r.url()); });
async function cleanup() {
  if (!productId) return;
  const r = await fetch(`${API_URL}/v1/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  console.log("cleanup:", (await fetch(`${API_URL}/v1/admin/products/${productId}`, { method: "DELETE", headers: { cookie } })).status);
}
const step = (s) => console.log("•", s);
const shot = (n) => page.screenshot({ path: join(OUT, `${n}.png`) });
const text = (t, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const click = async (label, sel = "button") => { const [h] = await page.$$(`xpath/.//${sel}[normalize-space()="${label}"]`); if (!h) throw new Error("no " + sel + " " + label); await h.click(); };
const tab = async (name) => { const [h] = await page.$$(`xpath/.//button[@role="tab"][normalize-space()="${name}"]`); await h.click(); };

try {
step("login");
await page.goto(`${ADMIN}/login`);
await page.type("input[name=email]", EMAIL);
await page.type("input[name=password]", PASSWORD);
await click("Sign in");
await text("Welcome");
await shot("1-dashboard");

step("products list shows the seeded catalog");
await page.goto(`${ADMIN}/products`);
await text("Aero Thermosteel Bottle");
const seeded = await page.$$eval("tbody tr", (r) => r.length);
console.log("  rows:", seeded);
await page.type("input[aria-label='Search products']", "copper");
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2, { timeout: 8000 });
step("search 'copper' narrows to 2");
await shot("2-products");

step("create product");
await page.goto(`${ADMIN}/products/new`);
await page.waitForSelector("input[name=title]");
await page.type("input[name=title]", `UI Test Bottle ${tag}`);
await page.waitForFunction(() => document.querySelectorAll("select[name=categoryId] option").length > 1, { timeout: 10000 });
const vac = await page.$$eval("select[name=categoryId] option", (o) => o.find((x) => x.textContent.includes("Vacuum"))?.value);
await page.select("select[name=categoryId]", vac);
const vals = await page.$$("input[placeholder='550 ml, 715 ml, 880 ml']");
await vals[0].type("500 ml, 750 ml");
await vals[1].type("Pink:#e8a0b4, Black:#111111");
await click("Create draft");
await page.waitForFunction(() => /\/products\/[a-z0-9]{20,}/.test(location.pathname), { timeout: 15000 });
productId = page.url().split("/").pop();
await text(`UI Test Bottle ${tag}`);
await shot("3-editor");

step("publish is blocked while incomplete");
await click("Publish");
await text("At least one active variant is required");
await text("At least one image is required");

step("generate 2x2 variants");
await tab("Options & Variants");
const gen = await page.$$("section input[inputmode=decimal], section input[inputmode=numeric]");
await gen[0].type("499"); await gen[1].type("599"); await gen[2].type("300");
await click("Generate");
await text("Created 4 variants");
const grid = await page.$$eval("tbody tr", (r) => r.length);
console.log("  variant rows:", grid);

step("set stock + price on first variant, save");
const stock = await page.$("input[aria-label$=' stock']");
await stock.evaluate((e) => e.select()); await stock.type("20");
const price = await page.$("input[aria-label$=' price']");
await price.evaluate((e) => e.select()); await price.type("449.50");
await click("Save changes");
await text("Saved 1 variant(s), 1 stock change(s)");
await shot("4-variants");

step("upload image");
await tab("Media");
await (await page.$("input[type=file]")).uploadFile(PNG);
await page.type("input[name=alt]", "Pink bottle front view");
await click("Upload");
await page.waitForSelector("ul img", { timeout: 15000 });
await shot("5-media");

step("fill description + required specs");
await tab("General");
await page.$eval("textarea[name=description]", (e) => (e.value = ""));
await page.type("textarea[name=description]", "<p>Test bottle</p><script>x()</script>");
await click("Save");
await text("Saved");
await tab("Specs");
await page.select("select[name=material]", "SS 304");
await page.type("input[name=country_of_origin]", "India");
await page.type("input[name=manufacturer]", "Test Pvt Ltd");
await click("Save specs");
await text("Saved");

step("publish succeeds");
await click("Publish");
await page.waitForFunction(() => [...document.querySelectorAll("span")].some((s) => s.textContent === "ACTIVE"), { timeout: 10000 });
await shot("6-published");

step("product appears in list as ACTIVE with min price 449.50");
await page.goto(`${ADMIN}/products`);
await page.waitForSelector("input[aria-label='Search products']");
await page.type("input[aria-label='Search products']", `UI Test Bottle ${tag}`);
await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1 && document.body.innerText.includes("₹449.50"), { timeout: 8000 });

step("categories + inventory screens render");
await page.goto(`${ADMIN}/categories`); await text("Bottles & Flasks"); await shot("7-categories");
await page.goto(`${ADMIN}/inventory`); await text("Low or out of stock");
await text("Aero Thermosteel Bottle"); // seeded sold-out combo
await shot("8-inventory");

step("sign-out protects routes");
await page.goto(`${ADMIN}/products`);
await page.waitForSelector('xpath/.//button[normalize-space()="Sign out"]', { timeout: 10000 });
await click("Sign out");
await page.waitForFunction(() => location.pathname === "/login", { timeout: 8000 });
await page.goto(`${ADMIN}/products`);
await page.waitForFunction(() => location.pathname === "/login", { timeout: 8000 });



} catch (e) {
  console.log("FAILED:", e.message.split("\n")[0]);
  await page.screenshot({ path: join(OUT, "fail.png") });
  console.log("alerts:", await page.$$eval("[role=alert]", (a) => a.map((x) => x.innerText)), "status:", await page.$$eval("[role=status]", (a) => a.map((x) => x.innerText)));
  console.log("problems:", problems); await cleanup(); await browser.close(); process.exit(1);
}
await cleanup();
await browser.close();
console.log(problems.length ? "BROWSER PROBLEMS:\n" + problems.join("\n") : "no console/page errors");
console.log("E2E PASSED. Screenshots:", OUT);
