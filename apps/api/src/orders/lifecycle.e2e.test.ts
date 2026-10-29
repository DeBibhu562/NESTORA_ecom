import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { boot, client } from "../test-utils";
import { OrderJobs } from "./jobs.service";

const db = new PrismaClient();
const tag = Date.now().toString(36);
const realFetch = globalThis.fetch;
let app: INestApplication, url: string, owner: ReturnType<typeof client>;
let variant: { id: string; pricePaise: number; warehouseId: string };
const orderIds: string[] = [];
const form = { name: "Life Cycle", phone: "9876500011", email: "life@example.com", paymentMethod: "COD", address: { line1: "12 MG Road", city: "Delhi", pincode: "110001" } };
const awb = `AWB${tag}`;

const level = () => db.inventoryLevel.findUniqueOrThrow({ where: { variantId_warehouseId: { variantId: variant.id, warehouseId: variant.warehouseId } } });
const hook = (status: string, at: string, token = "srtok") => realFetch(`${url}/v1/webhooks/shiprocket`, { method: "POST", headers: { "content-type": "application/json", "x-api-key": token }, body: JSON.stringify({ awb, current_status: status, current_timestamp: at }) });

beforeAll(async () => {
  ({ app, url } = await boot());
  owner = client(url);
  await owner.call("POST", "/admin/auth/login", { email: "owner@example.com", password: process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345" });
  const lvl = await db.inventoryLevel.findFirstOrThrow({ where: { onHand: { gte: 20 }, reserved: 0, warehouse: { isActive: true }, variant: { isActive: true, product: { status: "ACTIVE", deletedAt: null } } }, include: { variant: true } });
  variant = { id: lvl.variantId, pricePaise: lvl.variant.pricePaise, warehouseId: lvl.warehouseId };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const u = String(input);
    if (u.includes("shiprocket.in")) {
      if (u.endsWith("/auth/login")) return Response.json({ token: "t" });
      if (u.endsWith("/orders/create/adhoc")) return Response.json({ order_id: 11, shipment_id: 22 });
      if (u.endsWith("/courier/assign/awb")) return Response.json({ response: { data: { awb_code: awb, courier_name: "Delhivery" } } });
      if (u.endsWith("/courier/generate/label")) return Response.json({ label_url: "https://example.com/label.pdf" });
      return Response.json({});
    }
    return realFetch(input, init);
  });
});

afterAll(async () => {
  vi.restoreAllMocks();
  const ids = orderIds;
  const pays = (await db.payment.findMany({ where: { orderId: { in: ids } }, select: { id: true } })).map((p) => p.id);
  const rets = (await db.returnRequest.findMany({ where: { orderId: { in: ids } }, select: { id: true } })).map((r) => r.id);
  await db.refund.deleteMany({ where: { paymentId: { in: pays } } });
  await db.returnRequest.deleteMany({ where: { orderId: { in: ids } } });
  await db.payment.deleteMany({ where: { orderId: { in: ids } } });
  await db.stockReservation.deleteMany({ where: { orderId: { in: ids } } });
  await db.stockMovement.deleteMany({ where: { refId: { in: [...ids, ...rets] } } });
  await db.shipment.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  await db.$executeRaw`UPDATE "InventoryLevel" SET "onHand" = "onHand" + 2, reserved = 0 WHERE "variantId" = ${variant.id} AND "warehouseId" = ${variant.warehouseId}`; // restore the 2 units the test shipped
  await app.close(); await db.$disconnect();
});

it("runs an order from placed to refunded: courier booking, webhooks, invoice, return, restock and COD payout", async () => {
  const stock0 = (await level()).onHand;
  const cart = client(url);
  await cart.call("POST", "/cart/items", { variantId: variant.id, qty: 2 });
  const placed = await realFetch(`${url}/v1/checkout/orders`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": `life-${tag}`, cookie: `ct=${cart.jar.get("ct")}` }, body: JSON.stringify(form) }).then((r) => r.json());
  const order = await db.order.findUniqueOrThrow({ where: { publicId: placed.publicId }, include: { items: true } });
  orderIds.push(order.id);
  const adv = (to: string) => owner.call("POST", `/admin/orders/${order.id}/advance`, { to });

  expect((await adv("SHIPPED")).status).toBe(409); // can't skip steps
  for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED"]) expect((await adv(to)).status).toBe(200);
  const shipped = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { shipments: true } });
  expect(shipped.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/\d{6}$/);
  expect(shipped.shipments[0]).toMatchObject({ awb, courier: "Delhivery", labelUrl: "https://example.com/label.pdf", providerShipmentId: "22" });
  expect((await level()).onHand).toBe(stock0 - 2);

  expect((await hook("Delivered", "2026-10-29 10:00:00", "wrong")).status).toBe(400);
  expect((await hook("Out For Delivery", "2026-10-29 09:00:00")).status).toBe(200);
  expect((await hook("Out For Delivery", "2026-10-29 09:00:00")).status).toBe(200); // duplicate is harmless
  expect(await db.shipmentEvent.count({ where: { shipmentId: shipped.shipments[0]!.id } })).toBe(2); // "Shipped" + one OFD
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SHIPPED");
  expect((await hook("Delivered", "2026-10-29 10:00:00")).status).toBe(200);
  const done = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  expect(done.status).toBe("DELIVERED");
  expect(done.deliveredAt).not.toBeNull();
  expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("COD_COLLECTED");
  expect(await db.orderMessage.count({ where: { orderId: order.id } })).toBeGreaterThanOrEqual(5);

  const inv = await client(url).call("GET", `/orders/${placed.publicId}/invoice`);
  expect(inv.body.invoiceNumber).toBe(shipped.invoiceNumber);
  expect(inv.body.totals.totalPaise).toBe(order.totalPaise);
  expect((await owner.call("GET", "/admin/orders/queues")).body).toHaveProperty("inTransit");
  expect((await owner.call("GET", `/admin/orders/${order.id}`)).body.messages.length).toBeGreaterThan(3);

  const guest = client(url);
  const opts = await guest.call("GET", `/orders/${placed.publicId}/returns`);
  expect(opts.body).toMatchObject({ eligible: true, daysLeft: 7, cod: true });
  const itemId = order.items[0]!.id;
  const ask = { reason: "CHANGED_MIND", items: [{ orderItemId: itemId, qty: 1 }] };
  const upi = { refundMethod: "UPI", refundDetails: "asha@okbank" };
  expect((await guest.call("POST", `/orders/${placed.publicId}/returns`, ask)).status).toBe(400); // COD needs payout details
  expect((await guest.call("POST", `/orders/${placed.publicId}/returns`, { ...ask, refundMethod: "UPI", refundDetails: "not-a-upi" })).status).toBe(400);
  expect((await guest.call("POST", `/orders/${placed.publicId}/returns`, { ...ask, ...upi, reason: "DAMAGED" })).status).toBe(400); // photo required
  const made = await guest.call("POST", `/orders/${placed.publicId}/returns`, { ...ask, ...upi });
  expect(made.status).toBe(201);
  expect(made.body.refundPaise).toBe(Math.round(order.items[0]!.totalPaise / 2));
  const ret = await db.returnRequest.findFirstOrThrow({ where: { returnNumber: made.body.returnNumber } });
  expect(ret.refundDetails).not.toContain("asha"); // stored encrypted
  expect((await guest.call("POST", `/orders/${placed.publicId}/returns`, { ...ask, items: [{ orderItemId: itemId, qty: 2 }], ...upi })).status).toBe(409); // only 1 left to return

  expect((await owner.call("POST", `/admin/returns/${ret.id}/refund`, {})).status).toBe(409); // not received yet
  expect((await owner.call("POST", `/admin/returns/${ret.id}/approve`, {})).status).toBe(200);
  expect((await owner.call("POST", `/admin/returns/${ret.id}/receive`, { items: [] })).status).toBe(400);
  const before = (await level()).onHand;
  expect((await owner.call("POST", `/admin/returns/${ret.id}/receive`, { items: [{ orderItemId: itemId, restock: true }] })).status).toBe(200);
  expect((await level()).onHand).toBe(before + 1);
  expect((await owner.call("POST", `/admin/returns/${ret.id}/refund`, { amountPaise: made.body.refundPaise + 1 })).status).toBe(400); // can't exceed the calculated refund
  expect((await owner.call("POST", `/admin/returns/${ret.id}/refund`, {})).status).toBe(200);
  expect((await owner.call("POST", `/admin/returns/${ret.id}/refund`, {})).status).toBe(409); // no double refund

  const payouts = await owner.call("GET", "/admin/refunds/payouts");
  const mine = payouts.body.find((p: { returnNumber: string }) => p.returnNumber === made.body.returnNumber);
  expect(mine).toMatchObject({ method: "UPI", details: "asha@okbank", amountPaise: made.body.refundPaise });
  expect((await owner.call("POST", `/admin/refunds/${mine.id}/paid`, { utr: "UTR12345" })).status).toBe(200);
  expect((await owner.call("POST", `/admin/refunds/${mine.id}/paid`, { utr: "UTR12345" })).status).toBe(409);
  expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("PARTIALLY_REFUNDED");

  await db.order.update({ where: { id: order.id }, data: { deliveredAt: new Date(Date.now() - 8 * 86_400_000) } });
  const late = await guest.call("POST", `/orders/${placed.publicId}/returns`, { ...ask, ...upi });
  expect(late.status).toBe(409);
  expect(JSON.stringify(late.body)).toMatch(/window/);

  await app.get(OrderJobs).closeExpired();
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CLOSED"); // window over, no open return
});
