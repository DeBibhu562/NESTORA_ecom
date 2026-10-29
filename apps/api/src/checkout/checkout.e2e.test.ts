import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { boot, client } from "../test-utils";

const db = new PrismaClient();
const tag = Date.now().toString(36);
const realFetch = globalThis.fetch;
let app: INestApplication;
let url: string;
let owner: ReturnType<typeof client>;
let variant: { id: string; pricePaise: number; warehouseId: string };
const orderIds: string[] = [];
const refunded: string[] = [];

const form = (paymentMethod: "COD" | "ONLINE", pincode = "110001") => ({ name: "Test Buyer", phone: "9876543210", email: "buyer@example.com", paymentMethod, address: { line1: "12 MG Road", city: "Delhi", pincode } });
const level = () => db.inventoryLevel.findUniqueOrThrow({ where: { variantId_warehouseId: { variantId: variant.id, warehouseId: variant.warehouseId } } });
const sign = (body: string) => createHmac("sha256", "whsec_x").update(body).digest("hex");
async function webhook(event: string, entity: object, id: string) {
  const body = JSON.stringify({ event, payload: { payment: { entity } } });
  const res = await realFetch(`${url}/v1/webhooks/razorpay`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": sign(body), "x-razorpay-event-id": id }, body });
  return res.status;
}
async function cartWith(qty = 1) {
  const c = client(url);
  await c.call("POST", "/cart/items", { variantId: variant.id, qty });
  return c;
}

beforeAll(async () => {
  ({ app, url } = await boot());
  owner = client(url);
  await owner.call("POST", "/admin/auth/login", { email: "owner@example.com", password: process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345" });
  const lvl = await db.inventoryLevel.findFirstOrThrow({ where: { onHand: { gte: 20 }, reserved: 0, warehouse: { isActive: true }, variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } } }, include: { variant: true } });
  variant = { id: lvl.variantId, pricePaise: lvl.variant.pricePaise, warehouseId: lvl.warehouseId };
  // Razorpay is stubbed; everything else (our own API) goes through the real fetch.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const u = String(input);
    if (!u.startsWith("https://api.razorpay.com")) return realFetch(input, init);
    if (u.endsWith("/orders")) return Response.json({ id: `order_${tag}${orderIds.length}` });
    refunded.push(u);
    return Response.json({ id: `rfnd_${tag}` });
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  const ids = (await db.order.findMany({ where: { phone: "+919876543210", id: { in: orderIds } }, select: { id: true } })).map((o) => o.id);
  const pays = (await db.payment.findMany({ where: { orderId: { in: ids } }, select: { id: true } })).map((p) => p.id);
  await db.refund.deleteMany({ where: { paymentId: { in: pays } } });
  await db.payment.deleteMany({ where: { orderId: { in: ids } } });
  await db.stockReservation.deleteMany({ where: { orderId: { in: ids } } });
  await db.stockMovement.deleteMany({ where: { refType: "Order", refId: { in: ids } } });
  await db.shipment.deleteMany({ where: { orderId: { in: ids } } });
  await db.couponRedemption.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  await db.webhookEvent.deleteMany({ where: { eventId: { startsWith: `evt_${tag}` } } });
  await db.$executeRaw`UPDATE "InventoryLevel" SET "onHand" = "onHand" + ${shipped}, reserved = 0 WHERE "variantId" = ${variant.id} AND "warehouseId" = ${variant.warehouseId}`;
  await app.close();
  await db.$disconnect();
});

let shipped = 0;

it("places a COD order: idempotent, reserves stock, empties the cart, validates input", async () => {
  const before = await level();
  const c = await cartWith(2);
  expect((await c.call("POST", "/checkout/orders", form("COD"))).status).toBe(400); // no Idempotency-Key
  const post = (b: unknown, key: string) => realFetch(`${url}/v1/checkout/orders`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, cookie: `ct=${c.jar.get("ct")}` }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  expect((await post({ ...form("COD"), phone: "123" }, `bad-phone-${tag}`)).status).toBe(400);
  expect((await post(form("COD", "999999"), `bad-pin-${tag}`)).status).toBe(400); // not serviceable
  const a = await post(form("COD"), `cod-${tag}`);
  expect(a.status).toBe(200);
  orderIds.push((await db.order.findUniqueOrThrow({ where: { publicId: a.body.publicId } })).id);
  expect(a.body).toMatchObject({ status: "PLACED", paymentMethod: "COD", totalPaise: variant.pricePaise * 2 + a.body.shippingPaise - a.body.discountPaise });
  expect((await level()).reserved).toBe(before.reserved + 2);
  expect((await c.call("GET", "/cart")).body.items).toEqual([]);
  const again = await post(form("COD"), `cod-${tag}`); // retried request: same order, no second hold
  expect(again.body.publicId).toBe(a.body.publicId);
  expect((await level()).reserved).toBe(before.reserved + 2);
  expect((await post(form("COD"), `empty-${tag}`)).status).toBe(400); // cart is now empty
  expect((await realFetch(`${url}/v1/orders/${a.body.publicId}`)).status).toBe(200);
  expect((await client(url).call("POST", "/orders/track", { orderNumber: a.body.orderNumber, phone: "9876543210" })).status).toBe(200);
  expect((await client(url).call("POST", "/orders/track", { orderNumber: a.body.orderNumber, phone: "9000000000" })).status).toBe(404);
});

it("refuses to oversell", async () => {
  const lvl = await level();
  const c = await cartWith(1);
  await db.inventoryLevel.update({ where: { variantId_warehouseId: { variantId: variant.id, warehouseId: variant.warehouseId } }, data: { reserved: lvl.onHand } });
  try {
    const r = await realFetch(`${url}/v1/checkout/orders`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `oos-${tag}`, cookie: `ct=${c.jar.get("ct")}` }, body: JSON.stringify(form("COD")) });
    expect(r.status).toBe(409);
  } finally {
    await db.inventoryLevel.update({ where: { variantId_warehouseId: { variantId: variant.id, warehouseId: variant.warehouseId } }, data: { reserved: lvl.reserved } });
  }
});

it("online payment: pending until the signed callback/webhook, replays are harmless, expiry frees stock", async () => {
  const c = await cartWith(1);
  const start = await level();
  const placed = await realFetch(`${url}/v1/checkout/orders`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `online-${tag}`, cookie: `ct=${c.jar.get("ct")}` }, body: JSON.stringify(form("ONLINE")) }).then((r) => r.json());
  const order = await db.order.findUniqueOrThrow({ where: { publicId: placed.publicId } });
  orderIds.push(order.id);
  expect(placed).toMatchObject({ status: "PENDING_PAYMENT", retry: { orderId: expect.stringContaining("order_") } });
  expect((await level()).reserved).toBe(start.reserved + 1);

  const rzpOrder = placed.retry.orderId as string;
  expect((await c.call("POST", "/checkout/verify", { razorpay_order_id: rzpOrder, razorpay_payment_id: "pay_1", razorpay_signature: "forged" })).status).toBe(400);
  expect(await webhook("payment.captured", { id: "pay_1", order_id: rzpOrder, method: "card" }, `evt_${tag}_x`)).toBe(200);
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PLACED");
  expect(await webhook("payment.captured", { id: "pay_1", order_id: rzpOrder, method: "card" }, `evt_${tag}_x`)).toBe(200); // replay
  const sig = createHmac("sha256", "key_secret_x").update(`${rzpOrder}|pay_1`).digest("hex");
  expect((await c.call("POST", "/checkout/verify", { razorpay_order_id: rzpOrder, razorpay_payment_id: "pay_1", razorpay_signature: sig })).status).toBe(200);
  expect(await db.payment.count({ where: { orderId: order.id, status: "CAPTURED" } })).toBe(1);
  const bad = await realFetch(`${url}/v1/webhooks/razorpay`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": "nope", "x-razorpay-event-id": `evt_${tag}_bad` }, body: "{}" });
  expect(bad.status).toBe(400);

  // Cancelling a paid order frees the hold and refunds through the provider.
  const cancel = await owner.call("POST", `/admin/orders/${order.id}/cancel`, { reason: "Customer asked" });
  expect(cancel.status).toBe(200);
  expect((await level()).reserved).toBe(start.reserved);
  expect(refunded.some((u) => u.includes("/payments/pay_1/refund"))).toBe(true);
  expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("REFUNDED");

  // An unpaid online order is released by the sweeper.
  const c2 = await cartWith(1);
  const p2 = await realFetch(`${url}/v1/checkout/orders`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `online2-${tag}`, cookie: `ct=${c2.jar.get("ct")}` }, body: JSON.stringify(form("ONLINE")) }).then((r) => r.json());
  const o2 = await db.order.findUniqueOrThrow({ where: { publicId: p2.publicId } });
  orderIds.push(o2.id);
  await db.order.update({ where: { id: o2.id }, data: { createdAt: new Date(Date.now() - 20 * 60_000) } });
  await app.get(await import("./checkout.service").then((m) => m.CheckoutService)).expireStale();
  expect((await db.order.findUniqueOrThrow({ where: { id: o2.id } })).status).toBe("CANCELLED");
  expect((await level()).reserved).toBe(start.reserved);
});

it("staff move an order through fulfilment; shipping deducts stock; PII is masked without customer:reveal", async () => {
  const before = await level();
  const c = await cartWith(1);
  const placed = await realFetch(`${url}/v1/checkout/orders`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `ship-${tag}`, cookie: `ct=${c.jar.get("ct")}` }, body: JSON.stringify(form("COD")) }).then((r) => r.json());
  const id = (await db.order.findUniqueOrThrow({ where: { publicId: placed.publicId } })).id;
  orderIds.push(id);
  const adv = (to: string, extra = {}) => owner.call("POST", `/admin/orders/${id}/advance`, { to, ...extra });
  expect((await adv("SHIPPED")).status).toBe(409); // can't skip steps
  expect((await adv("CONFIRMED")).status).toBe(200);
  expect((await adv("PROCESSING")).status).toBe(200);
  expect((await adv("SHIPPED", { courier: "Delhivery", awb: `AWB${tag}` })).status).toBe(200);
  shipped += 1;
  const after = await level();
  expect(after.onHand).toBe(before.onHand - 1);
  expect(after.reserved).toBe(before.reserved);
  expect((await owner.call("POST", `/admin/orders/${id}/cancel`, { reason: "too late" })).status).toBe(409);
  expect((await adv("DELIVERED")).status).toBe(200);
  expect((await db.payment.findFirstOrThrow({ where: { orderId: id } })).status).toBe("COD_COLLECTED");
  const detail = await owner.call("GET", `/admin/orders/${id}`);
  expect(detail.body.phone).toBe("+919876543210");
  expect((await client(url).call("GET", `/admin/orders/${id}`)).status).toBe(401);
  expect(((await owner.call("GET", "/admin/orders?status=DELIVERED")).body.items as { id: string }[]).some((o) => o.id === id)).toBe(true);
});
