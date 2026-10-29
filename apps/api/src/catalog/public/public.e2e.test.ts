import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, client } from "../../test-utils";

// Relies on the seeded demo catalog (pnpm db:seed): 12 active bottles in the "bottles" tree.
const db = new PrismaClient();
let app: INestApplication;
let url: string;
const get = async (path: string) => { const r = await fetch(`${url}/v1/catalog${path}`); return { status: r.status, body: await r.json(), headers: r.headers }; };

beforeAll(async () => { ({ app, url } = await boot()); });
afterAll(async () => { await app.close(); await db.$disconnect(); });

describe("public catalog", () => {
  it("is readable without auth and cacheable", async () => {
    const r = await get("/products?category=bottles");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toMatch(/s-maxage=30/);
  });

  it("shows only active categories, with product counts", async () => {
    const tree = (await get("/categories")).body as { slug: string; productCount: number; children: { slug: string }[] }[];
    expect(tree.map((c) => c.slug)).toEqual(["bottles"]); // bottles is the only category
    expect(tree[0]!.productCount).toBe(12);
    expect(tree[0]!.children.map((c) => c.slug)).toContain("vacuum");
  });

  it("lists with facets and a price range", async () => {
    const { body } = await get("/products?category=bottles");
    expect(body.total).toBe(12);
    expect(body.category).toMatchObject({ name: "Bottles & Flasks", breadcrumbs: [{ path: "bottles" }] });
    const keys = body.facets.map((f: { key: string }) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["capacity", "material", "thermal_retention", "usage", "colour"]));
    expect(body.price.min).toBeLessThan(body.price.max);
    expect(body.items[0]).toHaveProperty("swatches");
  });

  it("filters by attribute, capacity bucket, colour, price and stock; URL params combine", async () => {
    expect((await get("/products?category=bottles&material=Copper")).body.total).toBe(2);
    expect((await get("/products?category=bottles&material=Copper&material=Glass")).body.total).toBe(3);
    const cap = (await get("/products?category=bottles&capacity=gt1000")).body;
    expect(cap.items.map((i: { title: string }) => i.title)).toEqual(expect.arrayContaining(["Trek Insulated Jug", "Heritage Copper Jug"]));
    expect((await get("/products?category=bottles&capacity=500-750|750-1000")).body.total).toBeGreaterThan(cap.total);
    expect((await get("/products?category=bottles&colour=Navy")).body.items.length).toBeGreaterThan(0);
    const cheap = (await get("/products?category=bottles&price=0-350")).body;
    expect(cheap.items.every((i: { minPricePaise: number }) => i.minPricePaise <= 35000)).toBe(true);
    expect((await get("/products?category=bottles/copper")).body.total).toBe(2);
  });

  it("sorts by price and paginates", async () => {
    const asc = (await get("/products?category=bottles&sort=price_asc&limit=5")).body;
    const prices = asc.items.map((i: { minPricePaise: number }) => i.minPricePaise);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
    expect(asc).toMatchObject({ page: 1, pages: 3, total: 12 });
    expect((await get("/products?category=bottles&sort=price_asc&limit=5&page=3")).body.items).toHaveLength(2);
  });

  it("searches and suggests", async () => {
    expect((await get("/products?q=copper")).body.items.map((i: { title: string }) => i.title)).toEqual(expect.arrayContaining(["Royal Copper Bottle", "Heritage Copper Jug"]));
    expect((await get("/suggest?q=aer")).body.items[0].title).toBe("Aero Thermosteel Bottle");
    expect((await get("/suggest?q=")).body.items).toEqual([]);
  });

  it("rejects bad input and unknown resources", async () => {
    expect((await get("/products?sort=hax")).status).toBe(400);
    expect((await get("/products?category=../etc")).status).toBe(400);
    expect((await get("/products?price=abc")).status).toBe(400);
    expect((await get("/products?category=nope")).status).toBe(404);
    expect((await get("/products?category=tiffins")).status).toBe(404); // not in the catalog
    expect((await get("/products/does-not-exist")).status).toBe(404);
  });

  it("checks pincodes: serviceable with ETA, unknown 404, malformed 400", async () => {
    const ok = await get("/pincode/110001");
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ city: "New Delhi", codAllowed: true });
    expect((await get("/pincode/999999")).status).toBe(404);
    expect((await get("/pincode/12ab")).status).toBe(400);
  });
});

describe("product detail", () => {
  it("returns a variant matrix, specs, breadcrumbs, media and related products", async () => {
    const { status, body: p } = await get("/products/aero-thermosteel-bottle");
    expect(status).toBe(200);
    expect(p.variants).toHaveLength(12);
    expect(p.options.map((o: { name: string }) => o.name)).toEqual(["Capacity", "Colour"]);
    expect(p.specs.map((s: { label: string }) => s.label)).toEqual(expect.arrayContaining(["Material", "Country of origin", "Warranty"]));
    expect(p.breadcrumbs.map((b: { name: string }) => b.name)).toEqual(["Bottles & Flasks", "Vacuum Thermosteel"]);
    expect(p.media.length).toBe(4);
    expect(p.related.length).toBeGreaterThan(0);
    expect(p.related.length).toBeLessThanOrEqual(8);
    expect(p.related.some((r: { slug: string }) => r.slug === p.slug)).toBe(false);
    expect(p.personalization).toEqual({ pricePaise: 9900 });
  });

  it("marks sold-out combos and never exposes raw inventory", async () => {
    const p = (await get("/products/aero-thermosteel-bottle")).body;
    const ids = (cap: string, col: string) => [p.options[0].values.find((v: { value: string }) => v.value === cap).id, p.options[1].values.find((v: { value: string }) => v.value === col).id];
    const has = (v: { optionValueIds: string[] }, want: string[]) => want.every((w) => v.optionValueIds.includes(w));
    const soldOut = p.variants.find((v: { optionValueIds: string[] }) => has(v, ids("880 ml", "Ivory")));
    const inStock = p.variants.find((v: { optionValueIds: string[] }) => has(v, ids("550 ml", "Pink")));
    expect(soldOut).toMatchObject({ inStock: false, maxQty: 0 });
    expect(inStock.inStock).toBe(true);
    expect(inStock.maxQty).toBeLessThanOrEqual(10);
    expect(JSON.stringify(p)).not.toMatch(/onHand|reserved|inventory/);
    const card = (await get("/products?q=aero")).body.items[0];
    expect(card.swatches.find((s: { value: string }) => s.value === "Ivory")).toMatchObject({ inStock: true }); // other capacities still in stock
  });

  it("sitemap lists products and categories", async () => {
    const s = (await get("/sitemap")).body;
    expect(s.products.length).toBe(12);
    expect(s.categories).toContain("bottles/vacuum");
  });
});

describe("stock alerts", () => {
  const post = (b: unknown) => fetch(`${url}/v1/catalog/stock-alerts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

  it("subscribes idempotently, normalises contacts, and rejects junk", async () => {
    const p = (await get("/products/aero-thermosteel-bottle")).body;
    const variantId = p.variants[0].id;
    expect((await post({ variantId, contact: "98765 43210" })).status).toBe(200);
    expect((await post({ variantId, contact: "+919876543210" })).status).toBe(200); // same number, different format
    expect((await post({ variantId, contact: "Test@Example.com" })).status).toBe(200);
    const rows = await db.stockAlertSubscription.findMany({ where: { variantId } });
    expect(rows.map((r) => r.contact).sort()).toEqual(["+919876543210", "test@example.com"]);
    expect((await post({ variantId, contact: "12345" })).status).toBe(400);
    expect((await post({ variantId: "nope", contact: "a@b.co" })).status).toBe(200); // no variant-existence oracle
    expect(await db.stockAlertSubscription.count({ where: { variantId: "nope" } })).toBe(0);
    await db.stockAlertSubscription.deleteMany({ where: { variantId } });
  });
});

describe("visibility", () => {
  it("hides drafts and unpublished products until published; hides them again when archived", async () => {
    const owner = client(url);
    await owner.call("POST", "/admin/auth/login", { email: "owner@example.com", password: process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345" });
    const cat = (await owner.call("GET", "/admin/categories")).body.find((c: { slug: string }) => c.slug === "bottles").children.find((c: { slug: string }) => c.slug === "vacuum");
    const p = (await owner.call("POST", "/admin/products", { title: `Visibility Test ${Date.now()}`, categoryId: cat.id, hsnCode: "7323", gstRateBp: 1800, descriptionHtml: "<p>x</p>", attributes: { material: "SS 304", country_of_origin: "India", manufacturer: "T" }, options: [{ name: "Capacity", values: [{ value: "500 ml" }] }] })).body;
    try {
      expect((await get(`/products/${p.slug}`)).status).toBe(404); // draft
      const w = (await owner.call("GET", "/admin/inventory/warehouses")).body[0];
      const g = (await owner.call("POST", `/admin/products/${p.id}/variants/generate`, { skuPrefix: "VIS", pricePaise: 10000, mrpPaise: 12000, weightGrams: 100 })).body;
      await owner.call("POST", "/admin/inventory/adjust", { variantId: g.product.variants[0].id, warehouseId: w.id, reason: "PURCHASE", delta: 3 });
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"))], { type: "image/png" }), "a.png");
      form.set("alt", "Visibility test image");
      await owner.call("POST", `/admin/products/${p.id}/media`, undefined, form);
      expect((await owner.call("POST", `/admin/products/${p.id}/status`, { status: "ACTIVE" })).status).toBe(200);
      expect((await get(`/products/${p.slug}`)).status).toBe(200);
      expect((await get("/products?category=bottles")).body.total).toBe(13);
      await owner.call("DELETE", `/admin/products/${p.id}`);
      expect((await get(`/products/${p.slug}`)).status).toBe(404);
      expect((await get("/products?category=bottles")).body.total).toBe(12);
    } finally {
      const vs = { variantId: { in: (await db.variant.findMany({ where: { productId: p.id }, select: { id: true } })).map((v) => v.id) } };
      await db.stockMovement.deleteMany({ where: vs }); await db.inventoryLevel.deleteMany({ where: vs });
      await db.product.deleteMany({ where: { id: p.id } });
    }
  });
});
