import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/crypto";
import { Notifier } from "../notify/notifier.service";
import { boot, client, adminLogin } from "../test-utils";

const db = new PrismaClient();
const tag = Date.now().toString(36);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let app: INestApplication;
let owner: ReturnType<typeof client>;
let support: ReturnType<typeof client>;
let url: string;
let categoryId: string;
let warehouseId: string;
const created = { products: [] as string[], staff: [] as string[], categories: [] as string[] };

beforeAll(async () => {
  ({ app, url } = await boot());
  owner = client(url);
  support = client(url);
  const role = await db.role.findUniqueOrThrow({ where: { name: "Support Agent" } });
  const st = await db.staffUser.create({ data: { email: `support-${tag}@test.dev`, name: "S", passwordHash: await hashPassword("Support!12345"), roleId: role.id } });
  created.staff.push(st.id);
  expect((await adminLogin(app, owner, "owner@example.com", process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345")).status).toBe(200);
  expect((await adminLogin(app, support, `support-${tag}@test.dev`, "Support!12345")).status).toBe(200);
  const cats = await owner.call("GET", "/admin/categories");
  categoryId = cats.body.find((c: { slug: string }) => c.slug === "bottles").children.find((c: { slug: string }) => c.slug === "vacuum").id;
  warehouseId = (await owner.call("GET", "/admin/inventory/warehouses")).body[0].id;
});

afterAll(async () => {
  const vs = { variantId: { in: (await db.variant.findMany({ where: { productId: { in: created.products } }, select: { id: true } })).map((v) => v.id) } };
  await db.stockMovement.deleteMany({ where: vs });
  await db.inventoryLevel.deleteMany({ where: vs });
  await db.product.deleteMany({ where: { id: { in: created.products } } });
  await db.category.deleteMany({ where: { id: { in: created.categories } } });
  await db.auditLog.deleteMany({ where: { staffId: { in: created.staff } } });
  await db.session.deleteMany({ where: { staffId: { in: created.staff } } });
  await db.staffUser.deleteMany({ where: { id: { in: created.staff } } });
  await app.close();
  await db.$disconnect();
});

describe("auth", () => {
  it("rejects anonymous, bad password, and unknown user alike", async () => {
    const anon = client(url);
    expect((await anon.call("GET", "/admin/categories")).status).toBe(401);
    expect((await anon.call("POST", "/admin/auth/login", { email: "owner@example.com", password: "wrong" })).status).toBe(401);
    expect((await anon.call("POST", "/admin/auth/login", { email: "nobody@example.com", password: "wrong" })).status).toBe(401);
  });

  it("locks an account out across IPs, rejects customer tokens, honours deactivation immediately and changes password", async () => {
    const email = `sec-${tag}@test.dev`;
    const role = await db.role.findUniqueOrThrow({ where: { name: "Support Agent" } });
    const st = await db.staffUser.create({ data: { email, name: "Sec", passwordHash: await hashPassword("Old-password-123"), roleId: role.id } });
    created.staff.push(st.id);
    const c = client(url);
    expect((await adminLogin(app, c, email, "Old-password-123")).status).toBe(200);
    expect((await c.call("GET", "/admin/auth/me")).status).toBe(200);

    // a token without the staff audience is refused
    const bad = jwt.sign({}, process.env.JWT_SECRET!, { subject: st.id, audience: "customer", algorithm: "HS256" });
    expect((await fetch(`${url}/v1/admin/auth/me`, { headers: { cookie: `at=${bad}` } })).status).toBe(401);

    // password change: weak rejected, wrong current rejected, then old password and old devices stop working
    expect((await c.call("POST", "/admin/auth/password", { current: "Old-password-123", password: "short" })).status).toBe(400);
    expect((await c.call("POST", "/admin/auth/password", { current: "nope", password: "New-password-1234" })).status).toBe(401);
    expect((await c.call("POST", "/admin/auth/password", { current: "Old-password-123", password: "New-password-1234" })).status).toBe(200);
    expect(await db.trustedDevice.count({ where: { staffId: st.id } })).toBe(0);
    expect((await client(url).call("POST", "/admin/auth/login", { email, password: "Old-password-123" })).status).toBe(401);

    // deactivation applies on the very next request
    await db.staffUser.update({ where: { id: st.id }, data: { isActive: false } });
    expect((await c.call("GET", "/admin/auth/me")).status).toBe(401);

    // failures from many different "browsers" still lock the account (the per-IP counter alone would not)
    for (let i = 0; i < 20; i++) await client(url).call("POST", "/admin/auth/login", { email, password: "guess" });
    expect((await client(url).call("POST", "/admin/auth/login", { email, password: "New-password-1234" })).status).toBe(429);
  });

  it("sets httpOnly cookies and rotates refresh tokens, revoking all sessions on reuse", async () => {
    const c = client(url);
    const login = (extra: object = {}, cookie = "") => fetch(`${url}/v1/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ email: "owner@example.com", password: "ChangeMe!12345", ...extra }) });
    expect((await login()).status).toBe(401); // new device: code emailed
    const code = /(\d{6})/.exec([...app.get(Notifier).outbox].reverse().find((m) => m.to === "owner@example.com")!.subject)![1]!;
    expect((await login({ otp: code === "000000" ? "111111" : "000000" })).status).toBe(401);
    const r = await login({ otp: code });
    expect(r.status).toBe(200);
    const dt = r.headers.getSetCookie().find((x) => x.startsWith("dt="))!.split(";")[0]!;
    expect((await login({}, dt)).status).toBe(200); // trusted device skips the code
    await db.trustedDevice.updateMany({ data: { verifiedAt: new Date(Date.now() - 31 * 86400_000) } });
    expect((await login({}, dt)).status).toBe(401); // 30 days passed: code again
    const cookies = r.headers.getSetCookie();
    expect(cookies.every((x) => /HttpOnly/i.test(x))).toBe(true);
    const rt1 = cookies.find((x) => x.startsWith("rt="))!.split(";")[0]!.slice(3);
    const call = (rt: string) => fetch(`${url}/v1/admin/auth/refresh`, { method: "POST", headers: { cookie: `rt=${rt}` } });
    const second = await call(rt1);
    expect(second.status).toBe(200);
    const rt2 = second.headers.getSetCookie().find((x) => x.startsWith("rt="))!.split(";")[0]!.slice(3);
    expect((await call(rt1)).status).toBe(401); // reuse of rotated token
    expect((await call(rt2)).status).toBe(401); // …kills the whole family
    void c;
  });

  it("enforces permissions (support agent can read but not write products)", async () => {
    expect((await support.call("GET", "/admin/products")).status).toBe(200);
    expect((await support.call("POST", "/admin/products", { title: "X" })).status).toBe(403);
    expect((await support.call("POST", "/admin/inventory/adjust", {})).status).toBe(403);
  });
});

describe("catalog flow", () => {
  let productId: string;
  let optionIds: { cap: string; col: string };

  it("creates a product with options, validating attributes and sanitising HTML", async () => {
    const bad = await owner.call("POST", "/admin/products", { title: "Bad", categoryId, hsnCode: "7323", gstRateBp: 1800, attributes: { material: "Gold" } });
    expect(bad.status).toBe(400);

    const r = await owner.call("POST", "/admin/products", {
      title: `Felice Test ${tag}`, categoryId, hsnCode: "7323", gstRateBp: 1800,
      descriptionHtml: `<p>Vacuum insulated</p><script>alert(1)</script><a href="javascript:x" onclick="x()">bad</a>`,
      attributes: { material: "SS 304", leak_proof: true, country_of_origin: "India", manufacturer: "Acme Pvt Ltd" },
      options: [
        { name: "Capacity", values: [{ value: "550 ml" }, { value: "715 ml" }, { value: "880 ml" }] },
        { name: "Colour", displayAs: "SWATCH", values: [{ value: "Pink", hexColor: "#e8a0b4" }, { value: "Ivory" }, { value: "Black", hexColor: "#111111" }, { value: "Olive Green" }] },
      ],
    });
    expect(r.status).toBe(201);
    productId = r.body.id;
    created.products.push(productId);
    expect(r.body.status).toBe("DRAFT");
    expect(r.body.descriptionHtml).not.toMatch(/script|javascript|onclick/);
    expect(r.body.slug).toMatch(/^felice-test-/);
    optionIds = { cap: r.body.options[0].id, col: r.body.options[1].id };
  });

  it("refuses to publish an incomplete product, listing every reason", async () => {
    const r = await owner.call("POST", `/admin/products/${productId}/status`, { status: "ACTIVE" });
    expect(r.status).toBe(400);
    const msgs = r.body.errors.map((e: { message: string }) => e.message);
    expect(msgs).toEqual(expect.arrayContaining(["At least one active variant is required", "At least one image is required"]));
  });

  it("generates the 12-SKU matrix, and is idempotent", async () => {
    const g = await owner.call("POST", `/admin/products/${productId}/variants/generate`, { skuPrefix: `T${tag.toUpperCase()}`, pricePaise: 80200, mrpPaise: 98000, weightGrams: 360 });
    expect(g.status).toBe(200);
    expect(g.body.created).toBe(12);
    expect(new Set(g.body.product.variants.map((v: { sku: string }) => v.sku)).size).toBe(12);
    const again = await owner.call("POST", `/admin/products/${productId}/variants/generate`, { skuPrefix: `T${tag.toUpperCase()}`, pricePaise: 80200, mrpPaise: 98000, weightGrams: 360 });
    expect(again.body.created).toBe(0);
  });

  it("locks options once variants exist but allows adding a value", async () => {
    expect((await owner.call("PUT", `/admin/products/${productId}/options`, [{ name: "X", values: [{ value: "a" }] }])).status).toBe(409);
    const v = await owner.call("POST", `/admin/products/${productId}/options/${optionIds.col}/values`, { value: "Navy", hexColor: "#001f3f" });
    expect(v.status).toBe(201);
    const g = await owner.call("POST", `/admin/products/${productId}/variants/generate`, { skuPrefix: `T${tag.toUpperCase()}`, pricePaise: 80200, mrpPaise: 98000, weightGrams: 360 });
    expect(g.body.created).toBe(3); // Navy × 3 capacities
  });

  it("bulk-edits prices and rejects MRP below price", async () => {
    const p = (await owner.call("GET", `/admin/products/${productId}`)).body;
    const [a, b] = p.variants;
    const ok = await owner.call("PATCH", `/admin/products/${productId}/variants`, [{ id: a.id, pricePaise: 90000, mrpPaise: 99000 }, { id: b.id, barcode: "8901234567890" }]);
    expect(ok.status).toBe(200);
    expect((await owner.call("PATCH", `/admin/products/${productId}/variants`, [{ id: a.id, mrpPaise: 100 }])).status).toBe(400);
  });

  it("uploads media (validating real image bytes) and then publishes", async () => {
    const form = (bytes: Buffer, name: string, alt = "Pink bottle front view") => { const f = new FormData(); f.set("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), name); f.set("alt", alt); return f; };
    expect((await owner.call("POST", `/admin/products/${productId}/media`, undefined, form(Buffer.from("<?php evil ?>"), "x.png"))).status).toBe(400);
    expect((await owner.call("POST", `/admin/products/${productId}/media`, undefined, form(PNG, "x.png", "a"))).status).toBe(400); // alt too short
    const up = await owner.call("POST", `/admin/products/${productId}/media`, undefined, form(PNG, "../../evil.png"));
    expect(up.status).toBe(201);
    expect(up.body.url).toMatch(/\/uploads\/[0-9a-f]{24}\.png$/);
    expect(up.body).toMatchObject({ width: 1, height: 1 });
    expect((await fetch(up.body.url.replace("http://localhost:4010", url))).status).toBe(200);

    const pub = await owner.call("POST", `/admin/products/${productId}/status`, { status: "ACTIVE" });
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe("ACTIVE");
  });

  it("adjusts stock via a ledger and blocks going below reserved", async () => {
    const p = (await owner.call("GET", `/admin/products/${productId}`)).body;
    const variantId = p.variants[0].id;
    const add = await owner.call("POST", "/admin/inventory/adjust", { variantId, warehouseId, reason: "PURCHASE", delta: 45 });
    expect(add.body.onHand).toBe(45);
    await db.inventoryLevel.update({ where: { variantId_warehouseId: { variantId, warehouseId } }, data: { reserved: 10 } });
    expect((await owner.call("POST", "/admin/inventory/adjust", { variantId, warehouseId, reason: "ADJUST", setOnHand: 5 })).status).toBe(409);
    expect((await owner.call("POST", "/admin/inventory/adjust", { variantId, warehouseId, reason: "ADJUST", delta: 0 })).status).toBe(400);
    const moves = await db.stockMovement.findMany({ where: { variantId } });
    expect(moves.map((m) => m.delta)).toEqual([45]);
    const low = await owner.call("GET", "/admin/inventory/low-stock");
    expect(low.status).toBe(200);
  });

  it("duplicates as a draft, bulk-changes status per product, and gates both by permission", async () => {
    const dup = await owner.call("POST", `/admin/products/${productId}/duplicate`);
    expect(dup.status).toBe(201);
    created.products.push(dup.body.id);
    expect(dup.body).toMatchObject({ status: "DRAFT", title: expect.stringContaining("(Copy)") });
    expect(dup.body.variants).toHaveLength(15);
    expect(new Set(dup.body.variants.map((v: { sku: string }) => v.sku)).size).toBe(15);
    expect(dup.body.variants.every((v: { options: unknown[] }) => v.options.length === 2)).toBe(true);

    // the copy has no images, so publishing it fails while the original succeeds
    const r = await owner.call("POST", "/admin/products/bulk-status", { ids: [productId, dup.body.id], status: "ACTIVE" });
    expect(r.body.updated).toBe(1);
    expect(r.body.failed).toEqual([{ id: dup.body.id, message: expect.stringContaining("image") }]);
    expect((await support.call("POST", "/admin/products/bulk-status", { ids: [productId], status: "DRAFT" })).status).toBe(403);
    expect((await support.call("POST", `/admin/products/${productId}/duplicate`)).status).toBe(403);
    expect((await owner.call("GET", "/admin/products?limit=1")).body.total).toBeGreaterThan(1);
  });

  it("lists with search and cursor pagination, and soft-deletes", async () => {
    const l = await owner.call("GET", `/admin/products?q=felice test ${tag}&limit=1`);
    expect(l.body.items).toHaveLength(1);
    expect(l.body.items[0]).toMatchObject({ variantCount: 15, minPricePaise: 80200 });
    expect((await owner.call("DELETE", `/admin/products/${productId}`)).status).toBe(204);
    expect((await owner.call("GET", `/admin/products/${productId}`)).status).toBe(404);

    const gone = await owner.call("GET", `/admin/products?status=DELETED&q=felice test ${tag}`);
    expect(gone.body.items.map((i: { id: string }) => i.id)).toContain(productId);
    expect((await support.call("POST", `/admin/products/${productId}/restore`)).status).toBe(403);
    expect((await owner.call("POST", `/admin/products/${productId}/restore`)).body).toMatchObject({ id: productId, status: "ARCHIVED", deletedAt: null });
    expect((await owner.call("POST", `/admin/products/${productId}/restore`)).status).toBe(404); // not deleted any more
  });

  it("writes audit entries for mutations", async () => {
    const n = await db.auditLog.count({ where: { entityId: productId } });
    expect(n).toBeGreaterThanOrEqual(5);
  });
});

describe("categories", () => {
  it("rewrites descendant paths on move and blocks cycles / deleting non-empty", async () => {
    const a = (await owner.call("POST", "/admin/categories", { name: `A ${tag}`, slug: `a-${tag}` })).body;
    const b = (await owner.call("POST", "/admin/categories", { name: `B ${tag}`, slug: `b-${tag}`, parentId: a.id })).body;
    const c = (await owner.call("POST", "/admin/categories", { name: `C ${tag}`, slug: `c-${tag}`, parentId: b.id })).body;
    created.categories.push(c.id, b.id, a.id);
    expect(c.path).toBe(`a-${tag}/b-${tag}/c-${tag}`);
    expect((await owner.call("PATCH", `/admin/categories/${a.id}`, { slug: `a2-${tag}` })).status).toBe(200);
    const tree = (await owner.call("GET", "/admin/categories")).body as { slug: string; children: { children: { path: string }[] }[] }[];
    expect(tree.find((t) => t.slug === `a2-${tag}`)!.children[0]!.children[0]!.path).toBe(`a2-${tag}/b-${tag}/c-${tag}`);
    expect((await owner.call("PATCH", `/admin/categories/${a.id}`, { parentId: c.id })).status).toBe(409);
    expect((await owner.call("DELETE", `/admin/categories/${a.id}`)).status).toBe(409);
  });
});
