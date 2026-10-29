import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, it } from "vitest";
import { boot, client } from "../test-utils";

const db = new PrismaClient();
let app: INestApplication;
let url: string;
let variant: { id: string; pricePaise: number };

beforeAll(async () => {
  ({ app, url } = await boot());
  const lvl = await db.inventoryLevel.findFirstOrThrow({ where: { onHand: { gte: 5 }, variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } } }, include: { variant: true } });
  variant = { id: lvl.variantId, pricePaise: lvl.variant.pricePaise };
});
afterAll(async () => { await app.close(); await db.$disconnect(); });

it("builds a cart from the cookie, re-prices server-side and merges duplicate adds", async () => {
  const c = client(url);
  expect((await c.call("GET", "/cart")).body.items).toEqual([]);
  const a = await c.call("POST", "/cart/items", { variantId: variant.id, qty: 2, unitPaise: 1 }); // extra price field must be ignored
  expect(a.status).toBe(200);
  expect(c.jar.get("ct")).toBeTruthy();
  const b = await c.call("POST", "/cart/items", { variantId: variant.id, qty: 1 });
  expect(b.body.items).toHaveLength(1);
  expect(b.body.items[0]).toMatchObject({ qty: 3, unitPaise: variant.pricePaise });
  expect(b.body.subtotalPaise).toBe(variant.pricePaise * 3);
  expect(Array.isArray(b.body.upsells)).toBe(true);

  const id = b.body.items[0].id;
  expect((await c.call("PATCH", `/cart/items/${id}`, { qty: 1 })).body.items[0].qty).toBe(1);
  expect((await c.call("DELETE", `/cart/items/${id}`)).body.items).toEqual([]);
});

it("rejects over-stock, bad engraving, unknown variants and bad coupons; isolates carts", async () => {
  const c = client(url);
  expect((await c.call("POST", "/cart/items", { variantId: "nope", qty: 1 })).status).toBe(404);
  expect((await c.call("POST", "/cart/items", { variantId: variant.id, qty: 99 })).status).toBe(400);
  expect((await c.call("POST", "/cart/items", { variantId: variant.id, qty: 1, engraving: "x".repeat(16) })).status).toBe(400);
  const ok = await c.call("POST", "/cart/items", { variantId: variant.id, qty: 1 });
  expect((await c.call("PUT", "/cart/coupon", { code: "NOPE" })).status).toBe(400);
  const withCoupon = await c.call("PUT", "/cart/coupon", { code: "diwali15" });
  expect(withCoupon.status, JSON.stringify(withCoupon.body)).toBe(200);
  expect(withCoupon.body.coupon).toMatchObject({ code: "DIWALI15" });
  expect((await c.call("PUT", "/cart/coupon", { code: null })).body.coupon).toBeNull();

  const other = client(url);
  expect((await other.call("PATCH", `/cart/items/${ok.body.items[0].id}`, { qty: 2 })).status).toBe(404);
});
