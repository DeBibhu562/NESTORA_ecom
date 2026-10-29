import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Notifier } from "../notify/notifier.service";
import { boot, client } from "../test-utils";

const db = new PrismaClient();
const tag = Date.now().toString(36);
const realFetch = globalThis.fetch;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
let app: INestApplication;
let url: string;
let mail: Notifier;
const emails = [`a-${tag}@test.dev`, `g-${tag}@test.dev`, `p-${tag}@test.dev`, `l-${tag}@test.dev`, `h-${tag}@test.dev`, `h2-${tag}@test.dev`, `m-${tag}@test.dev`, `n-${tag}@test.dev`, `r-${tag}@test.dev`, `lock-${tag}@test.dev`];

const lastCode = (to: string) => /(\d{6})/.exec([...mail.outbox].reverse().find((m) => m.to === to)!.subject)![1]!;
const firebaseToken = (over: object = {}, opts: jwt.SignOptions = {}) =>
  jwt.sign({ email: `g-${tag}@test.dev`, email_verified: true, name: "Gina", firebase: { sign_in_provider: "google.com" }, ...over }, privateKey, { algorithm: "RS256", keyid: "k1", subject: "uid-" + tag, audience: "test-proj", issuer: "https://securetoken.google.com/test-proj", expiresIn: 600, ...opts });

beforeAll(async () => {
  ({ app, url } = await boot());
  mail = app.get(Notifier);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) =>
    String(input).includes("securetoken@system.gserviceaccount.com") ? Response.json({ k1: publicKey.export({ type: "spki", format: "pem" }) }, { headers: { "cache-control": "max-age=60" } }) : realFetch(input, init));
});
afterAll(async () => {
  vi.restoreAllMocks();
  const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await db.cart.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await db.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.otpChallenge.deleteMany({ where: { target: { in: emails } } });
  await app.close();
  await db.$disconnect();
});

it("registers with email + password, verifies by emailed code, then signs in", async () => {
  const [email] = emails as [string];
  const c = client(url);
  expect((await c.call("POST", "/account/register", { name: "Asha", email, password: "short" })).status).toBe(400);
  expect((await c.call("POST", "/account/register", { name: "Asha", email, password: "Correct-Horse-1" })).status).toBe(200);
  expect((await c.call("POST", "/account/login", { email, password: "Correct-Horse-1" })).body).toMatchObject({ code: "EMAIL_UNVERIFIED" }); // also re-sends a code
  expect((await c.call("GET", "/account/me")).status).toBe(401);

  expect((await c.call("POST", "/account/verify", { email, code: "000000" })).status).toBe(400);
  const ok = await c.call("POST", "/account/verify", { email, code: lastCode(email) });
  expect(ok.status).toBe(200);
  expect(ok.body).toMatchObject({ email, name: "Asha", hasPassword: true });
  expect((await c.call("GET", "/account/me")).body.email).toBe(email);
  // Registering an address that already has an account looks identical to a fresh sign-up, doesn't touch the account, and tells the owner by email.
  const n = mail.outbox.length;
  expect((await c.call("POST", "/account/register", { name: "Mallory", email, password: "Another-Pass-1" })).body).toEqual({ sent: true });
  expect(mail.outbox.slice(n).map((m) => m.subject)).toEqual(["You already have an account"]);

  const c2 = client(url);
  expect((await c2.call("POST", "/account/login", { email, password: "wrong-password" })).status).toBe(401);
  expect((await c2.call("POST", "/account/login", { email: email.toUpperCase(), password: "Correct-Horse-1" })).status).toBe(200);
  expect((await client(url).call("POST", "/account/login", { email, password: "Another-Pass-1" })).status).toBe(401);
  // staff routes stay closed to customers
  expect((await c2.call("GET", "/admin/orders")).status).toBe(401);

  const before = c2.jar.get("cu");
  expect((await c2.call("POST", "/account/refresh")).status).toBe(200);
  expect(c2.jar.get("cu")).toBeTruthy();
  expect(before).toBeTruthy();
  expect((await c2.call("POST", "/account/logout")).status).toBe(200);
  expect((await c2.call("GET", "/account/me")).status).toBe(401);
  expect((await c2.call("POST", "/account/refresh")).status).toBe(401);
});

it("locks a code after 5 wrong guesses and limits how many codes can be requested", async () => {
  const email = emails[3]!;
  const c = client(url);
  await c.call("POST", "/account/code", { email });
  const real = lastCode(email);
  const wrong = real === "123456" ? "654321" : "123456";
  for (let i = 0; i < 5; i++) expect((await c.call("POST", "/account/verify", { email, code: wrong })).status).toBe(400);
  expect((await c.call("POST", "/account/verify", { email, code: real })).status).toBe(400); // burned
  for (let i = 0; i < 3; i++) await c.call("POST", "/account/code", { email });
  expect((await c.call("POST", "/account/code", { email })).status).toBe(200); // 5th in the hour
  expect((await c.call("POST", "/account/code", { email })).status).toBe(429);
});

it("resets a forgotten password with a code and signs out other devices", async () => {
  const email = emails[2]!;
  const a = client(url);
  await a.call("POST", "/account/register", { name: "Pat", email, password: "Original-Pass-1" });
  await a.call("POST", "/account/verify", { email, code: lastCode(email) });
  expect((await a.call("GET", "/account/me")).status).toBe(200);

  const b = client(url);
  expect((await b.call("POST", "/account/forgot", { email: "nobody@test.dev" })).status).toBe(200); // same answer for unknown emails
  expect((await b.call("POST", "/account/forgot", { email })).status).toBe(200);
  expect((await b.call("POST", "/account/reset", { email, code: lastCode(email), password: "Brand-New-Pass-2" })).status).toBe(200);
  expect((await b.call("POST", "/account/login", { email, password: "Original-Pass-1" })).status).toBe(401);
  expect((await b.call("POST", "/account/login", { email, password: "Brand-New-Pass-2" })).status).toBe(200);
  expect((await a.call("POST", "/account/refresh")).status).toBe(401);
});

it("signs in with a Firebase Google token and rejects forged ones", async () => {
  const c = client(url);
  expect((await c.call("GET", "/account/config")).body).toEqual({ google: true });
  for (const bad of [
    firebaseToken({}, { audience: "other-project" }),
    firebaseToken({ email_verified: false }),
    firebaseToken({ firebase: { sign_in_provider: "password" } }),
    firebaseToken({}, { expiresIn: -10 }),
    jwt.sign({ email: "x@test.dev", email_verified: true }, "not-the-google-key", { keyid: "k1" }),
    firebaseToken().slice(0, -4) + "AAAA",
  ]) expect((await c.call("POST", "/account/google", { idToken: bad })).status).toBe(401);

  const ok = await c.call("POST", "/account/google", { idToken: firebaseToken() });
  expect(ok.status).toBe(200);
  expect(ok.body).toMatchObject({ email: `g-${tag}@test.dev`, name: "Gina", google: true, hasPassword: false });
  // same Google account again → same user
  const again = await client(url).call("POST", "/account/google", { idToken: firebaseToken() });
  expect(again.body.id).toBe(ok.body.id);
  // a Google user can set a password afterwards
  expect((await c.call("PUT", "/account/password", { password: "Google-User-Pass-1" })).status).toBe(200);
  expect((await client(url).call("POST", "/account/login", { email: `g-${tag}@test.dev`, password: "Google-User-Pass-1" })).status).toBe(200);
});

it("links checkout orders to the signed-in customer and lists them", async () => {
  const email = emails[1]!;
  const c = client(url);
  await c.call("POST", "/account/google", { idToken: firebaseToken() });
  const lvl = await db.inventoryLevel.findFirstOrThrow({ where: { onHand: { gte: 5 }, reserved: 0, warehouse: { isActive: true }, variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } } } });
  await c.call("POST", "/cart/items", { variantId: lvl.variantId, qty: 1 });
  const placed = await realFetch(`${url}/v1/checkout/orders`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": `acct-${tag}`, cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    body: JSON.stringify({ name: "Gina", phone: "9876543210", email, paymentMethod: "COD", address: { line1: "1 Road", city: "Delhi", pincode: "110001" } }),
  }).then((r) => r.json());
  expect(placed.orderNumber).toBeTruthy();
  const mine = await c.call("GET", "/account/orders");
  expect(mine.body.map((o: { orderNumber: string }) => o.orderNumber)).toContain(placed.orderNumber);
  expect(mail.outbox.some((m) => m.to === email && m.subject.includes(placed.orderNumber))).toBe(true); // confirmation email
  expect((await client(url).call("GET", "/account/orders")).status).toBe(401);

  const o = await db.order.findUniqueOrThrow({ where: { publicId: placed.publicId } });
  await db.payment.deleteMany({ where: { orderId: o.id } });
  const held = await db.stockReservation.findMany({ where: { orderId: o.id } });
  for (const r of held) await db.$executeRaw`UPDATE "InventoryLevel" SET reserved = reserved - ${r.qty} WHERE "variantId" = ${r.variantId} AND "warehouseId" = ${r.warehouseId}`;
  await db.stockReservation.deleteMany({ where: { orderId: o.id } });
  await db.order.delete({ where: { id: o.id } });
});

it("locks password sign-in after 5 failures, even for the right password", async () => {
  const email = `lock-${tag}@test.dev`;
  const c = client(url);
  for (let i = 0; i < 5; i++) expect((await c.call("POST", "/account/login", { email, password: "nope-nope-nope" })).status).toBe(401);
  expect((await c.call("POST", "/account/login", { email, password: "nope-nope-nope" })).status).toBe(429);
});

it("doesn't let a pre-registered password survive when the real owner proves the address", async () => {
  // Attacker registers the victim's address with their own password; the victim then signs in by code, or with Google.
  const [byCode, byGoogle] = [emails[4]!, emails[5]!];
  await client(url).call("POST", "/account/register", { name: "Attacker", email: byCode, password: "Attacker-Pass-1" });
  const victim = client(url);
  await victim.call("POST", "/account/code", { email: byCode });
  expect((await victim.call("POST", "/account/verify", { email: byCode, code: lastCode(byCode) })).status).toBe(200);
  expect((await client(url).call("POST", "/account/login", { email: byCode, password: "Attacker-Pass-1" })).status).toBe(401);

  await client(url).call("POST", "/account/register", { name: "Attacker", email: byGoogle, password: "Attacker-Pass-1" });
  expect((await client(url).call("POST", "/account/google", { idToken: firebaseToken({ email: byGoogle }, { subject: "uid-h2-" + tag }) })).status).toBe(200);
  expect((await client(url).call("POST", "/account/login", { email: byGoogle, password: "Attacker-Pass-1" })).status).toBe(401);
});

it("re-links a Google account whose uid changed, since Google still proves the email", async () => {
  const email = emails[8]!;
  await db.user.create({ data: { email, emailVerified: true, googleUid: "old-uid-" + tag } });
  const r = await client(url).call("POST", "/account/google", { idToken: firebaseToken({ email }, { subject: "new-uid-" + tag }) });
  expect(r.status).toBe(200);
  expect((await db.user.findUniqueOrThrow({ where: { email } })).googleUid).toBe("new-uid-" + tag);
});

it("merges the guest cart into the account's cart on sign-in, on any device", async () => {
  const email = emails[6]!;
  const lvl = await db.inventoryLevel.findFirstOrThrow({ where: { onHand: { gte: 10 }, warehouse: { isActive: true }, variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } } } });
  const signIn = async (c: ReturnType<typeof client>) => { await c.call("POST", "/account/code", { email }); return c.call("POST", "/account/verify", { email, code: lastCode(email) }); };

  // First visit: guest cart (qty 1) is adopted by the new account.
  const phone = client(url);
  await phone.call("POST", "/cart/items", { variantId: lvl.variantId, qty: 1 });
  await signIn(phone);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(await db.cart.count({ where: { userId: user.id } })).toBe(1);
  expect((await phone.call("GET", "/cart")).body.items[0].qty).toBe(1);

  // Later: another browser builds its own guest cart (qty 2), then signs in -> quantities add up, one cart remains.
  const laptop = client(url);
  await laptop.call("POST", "/cart/items", { variantId: lvl.variantId, qty: 2 });
  await signIn(laptop);
  expect(await db.cart.count({ where: { userId: user.id } })).toBe(1);
  const merged = (await laptop.call("GET", "/cart")).body;
  expect(merged.items).toHaveLength(1);
  expect(merged.items[0].qty).toBe(3);

  // A device with no cart at all gets the account's cart (and a cookie for it).
  const tablet = client(url);
  expect((await tablet.call("GET", "/cart")).body.items).toEqual([]);
  await signIn(tablet);
  expect((await tablet.call("GET", "/cart")).body.items[0].qty).toBe(3);
});
