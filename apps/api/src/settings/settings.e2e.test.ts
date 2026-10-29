import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, it } from "vitest";
import { hashPassword } from "../auth/crypto";
import { boot, client } from "../test-utils";

const db = new PrismaClient();
const tag = Date.now().toString(36);
let app: INestApplication;
let owner: ReturnType<typeof client>;
let support: ReturnType<typeof client>;
let url: string;
let staffId: string;
let original: { flatPaise: number; freeAbovePaise: number };

beforeAll(async () => {
  ({ app, url } = await boot());
  owner = client(url);
  support = client(url);
  const role = await db.role.findUniqueOrThrow({ where: { name: "Support Agent" } });
  staffId = (await db.staffUser.create({ data: { email: `settings-${tag}@test.dev`, name: "S", passwordHash: await hashPassword("Support!12345"), roleId: role.id } })).id;
  await owner.call("POST", "/admin/auth/login", { email: "owner@example.com", password: process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345" });
  await support.call("POST", "/admin/auth/login", { email: `settings-${tag}@test.dev`, password: "Support!12345" });
  original = (await owner.call("GET", "/admin/settings/shipping")).body;
});

afterAll(async () => {
  await owner.call("PUT", "/admin/settings/shipping", original);
  await db.serviceablePincode.deleteMany({ where: { pincode: { in: ["999991", "999992", "999993"] } } });
  await db.coupon.deleteMany({ where: { code: `T${tag.toUpperCase()}` } });
  await db.auditLog.deleteMany({ where: { staffId } });
  await db.session.deleteMany({ where: { staffId } });
  await db.staffUser.delete({ where: { id: staffId } });
  await app.close();
  await db.$disconnect();
});

it("is owner-only and validates shipping values", async () => {
  expect((await support.call("GET", "/admin/settings/shipping")).status).toBe(403);
  expect((await support.call("PUT", "/admin/settings/shipping", { flatPaise: 100, freeAbovePaise: 100 })).status).toBe(403);
  expect((await client(url).call("GET", "/admin/pincodes")).status).toBe(401);
  expect((await owner.call("PUT", "/admin/settings/shipping", { flatPaise: -1, freeAbovePaise: 100 })).status).toBe(400);
  expect((await owner.call("PUT", "/admin/settings/shipping", { flatPaise: 1.5, freeAbovePaise: 100 })).status).toBe(400);
});

it("drives the cart's shipping fee and free-shipping threshold", async () => {
  const lvl = await db.inventoryLevel.findFirstOrThrow({ where: { onHand: { gte: 5 }, variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } } }, include: { variant: true } });
  const price = lvl.variant.pricePaise;
  const save = await owner.call("PUT", "/admin/settings/shipping", { flatPaise: 4500, freeAbovePaise: price + 1 });
  expect(save.body).toEqual({ flatPaise: 4500, freeAbovePaise: price + 1 });

  const c = client(url);
  expect((await c.call("POST", "/cart/items", { variantId: lvl.variantId, qty: 1 })).body).toMatchObject({ shippingPaise: 4500, totalPaise: price + 4500 });
  await owner.call("PUT", "/admin/settings/shipping", { flatPaise: 4500, freeAbovePaise: price });
  expect((await c.call("GET", "/cart")).body).toMatchObject({ shippingPaise: 0, totalPaise: price });
});

it("manages pincodes: validate, upsert, search, bulk import, delete", async () => {
  const body = { city: "Testville", state: "DL", codAllowed: true, etaDaysMin: 2, etaDaysMax: 4 };
  expect((await owner.call("PUT", "/admin/pincodes/12345", body)).status).toBe(400);
  expect((await owner.call("PUT", "/admin/pincodes/999991", { ...body, etaDaysMax: 1 })).status).toBe(400);
  expect((await owner.call("PUT", "/admin/pincodes/999991", body)).body).toMatchObject({ pincode: "999991", codAllowed: true });
  expect((await owner.call("PUT", "/admin/pincodes/999991", { ...body, codAllowed: false })).body.codAllowed).toBe(false);

  const imp = await owner.call("POST", "/admin/pincodes/import", { rows: [{ pincode: "999992", ...body }, { pincode: "999993", ...body }, { pincode: "999992", ...body, city: "Dup" }] });
  expect(imp.body).toEqual({ saved: 2 });
  expect((await owner.call("POST", "/admin/pincodes/import", { rows: [{ pincode: "abc", ...body }] })).status).toBe(400);

  const found = await owner.call("GET", "/admin/pincodes?q=99999&limit=2");
  expect(found.body.items).toHaveLength(2);
  expect(found.body.total).toBe(3);
  expect(found.body.nextCursor).toBeTruthy();
  expect((await owner.call("GET", "/admin/pincodes?q=Dup")).body.items[0].pincode).toBe("999992");

  expect((await owner.call("DELETE", "/admin/pincodes/999991")).status).toBe(204);
  expect((await owner.call("DELETE", "/admin/pincodes/999991")).status).toBe(404);
  expect((await support.call("DELETE", "/admin/pincodes/999992")).status).toBe(403);
});

it("manages coupons and cart milestones, owner-only, with validation", async () => {
  const code = `T${tag.toUpperCase()}`;
  const c = { type: "PERCENT", valueBp: 1000, valuePaise: null, maxDiscountPaise: null, minSubtotalPaise: 0, usageLimit: null, endsAt: null, isActive: true };
  expect((await support.call("PUT", `/admin/coupons/${code}`, c)).status).toBe(403);
  expect((await owner.call("PUT", "/admin/coupons/bad-code", c)).status).toBe(400);
  expect((await owner.call("PUT", `/admin/coupons/${code}`, { ...c, valueBp: null })).status).toBe(400);
  expect((await owner.call("PUT", `/admin/coupons/${code}`, c)).status).toBe(200);
  expect((await owner.call("PUT", `/admin/coupons/${code}`, { ...c, isActive: false })).body.isActive).toBe(false);
  expect(((await owner.call("GET", "/admin/coupons")).body as { code: string }[]).some((x) => x.code === code)).toBe(true);

  const m = { label: "Test reward", thresholdPaise: 999900, position: 50, rewardType: "DISCOUNT", valuePaise: null, isActive: true };
  expect((await owner.call("POST", "/admin/milestones", m)).status).toBe(400); // discount needs an amount
  const made = await owner.call("POST", "/admin/milestones", { ...m, valuePaise: 10000 });
  expect(made.status).toBe(200);
  expect((await owner.call("PUT", `/admin/milestones/${made.body.id}`, { ...m, valuePaise: 20000 })).body.valuePaise).toBe(20000);
  expect((await owner.call("DELETE", `/admin/milestones/${made.body.id}`)).status).toBe(204);
  expect((await owner.call("DELETE", `/admin/milestones/${made.body.id}`)).status).toBe(404);
});
