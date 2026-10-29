import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { CartService } from "../cart/cart.service";
import { env } from "../env";
import { canAdvance, canCancel, type Step } from "../orders/lifecycle";
import { OrderMessenger } from "../orders/messenger.service";
import { SettingsService } from "../settings/settings.service";
import { PrismaService } from "../prisma.service";
import { createRzpOrder, razorpayEnabled, refundRzp } from "./razorpay";

const HOLD_MS = 15 * 60_000;
const YEAR_MS = 365 * 24 * 3600_000;
const fail = (status: number, title: string) => new HttpException({ title }, status);

export type CheckoutInput = {
  name: string; phone: string; email?: string; paymentMethod: "COD" | "ONLINE";
  address: { line1: string; line2?: string; landmark?: string; city: string; pincode: string };
};

type Tx = Prisma.TransactionClient;

@Injectable()
export class CheckoutService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Checkout");
  private timer?: NodeJS.Timeout;
  constructor(private readonly db: PrismaService, private readonly cart: CartService, private readonly messenger: OrderMessenger, private readonly settings: SettingsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.expireStale().catch((e) => this.log.error(e)), 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  config() { return { online: razorpayEnabled(), keyId: env.RAZORPAY_KEY_ID ?? null }; }

  async place(token: string | undefined, key: string, b: CheckoutInput, userId: string | null = null) {
    const dup = await this.db.order.findUnique({ where: { idempotencyKey: key }, select: { publicId: true } });
    if (dup) return this.result(dup.publicId);
    if (b.paymentMethod === "ONLINE" && !razorpayEnabled()) throw fail(400, "Online payment isn't available right now");

    const pin = await this.db.serviceablePincode.findUnique({ where: { pincode: b.address.pincode } });
    if (!pin) throw fail(400, "Sorry, we don't deliver to this pincode yet");
    if (b.paymentMethod === "COD" && !pin.codAllowed) throw fail(400, "Cash on delivery isn't available for this pincode");

    const cartRow = token ? await this.cart.findByToken(token) : null;
    const wh = await this.db.warehouse.findFirst({ where: { isActive: true }, orderBy: { code: "asc" } });
    if (!cartRow || !wh) throw fail(400, "Your cart is empty");
    const built = await this.cart.build(cartRow.id, pin.state === wh.state);
    if (!built.lines.length) throw fail(400, "Your cart is empty");
    const bad = built.view.items.find((i) => !i.inStock);
    if (bad) throw fail(409, `${bad.title} is no longer available in the quantity you chose`);
    const { priced, lines } = built;
    const online = b.paymentMethod === "ONLINE";
    const address = { name: b.name, phone: b.phone, ...b.address, city: b.address.city, state: pin.state };

    let order;
    try {
      order = await this.db.$transaction(async (tx) => {
        const [seq] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_seq') AS n`;
        const o = await tx.order.create({
          data: {
            orderNumber: `ORD-${seq!.n}`, publicId: randomBytes(16).toString("hex"), status: online ? "PENDING_PAYMENT" : "PLACED", placedAt: online ? null : new Date(),
            userId, email: b.email ?? null, phone: b.phone, shippingAddress: address, billingAddress: address,
            subtotalPaise: priced.subtotal, discountPaise: priced.couponDiscount + priced.rewardDiscount + priced.offerDiscount, shippingPaise: priced.shipping,
            taxPaise: priced.tax, totalPaise: priced.total, paymentMethod: online ? "UPI" : "COD", // refined by the webhook once the customer picks a method
            couponCodes: built.coupon ? [built.coupon.code] : [], idempotencyKey: key,
            items: {
              create: lines.map((l, k) => {
                const pl = priced.lines[k]!;
                return {
                  variantId: l.i.variantId, sku: l.i.variant.sku, title: l.p.title, variantTitle: l.i.variant.options.map((o) => o.optionValue.value).join(" / "),
                  imageUrl: l.p.media[0]?.url ?? "", hsnCode: l.p.hsnCode, gstRateBp: l.p.gstRateBp, unitPricePaise: l.unit, mrpPaise: l.i.variant.mrpPaise, qty: l.i.qty,
                  discountPaise: pl.coupon + pl.reward + pl.offer, taxPaise: pl.tax, totalPaise: pl.net, engraving: l.i.engraving || null, isGift: l.i.isGift,
                };
              }),
            },
            events: { create: { type: "placed", message: online ? "Awaiting payment" : "Order placed (cash on delivery)", actor: "customer" } },
            ...(online ? {} : { payments: { create: { method: "COD", status: "COD_PENDING", amountPaise: priced.total } } }),
          },
        });
        for (const l of lines) await this.reserve(tx, o.id, l.i.variantId, l.i.qty, online ? new Date(Date.now() + HOLD_MS) : new Date(Date.now() + YEAR_MS));
        if (built.coupon) {
          const c = built.coupon;
          const hit = await tx.coupon.updateMany({ where: { id: c.id, usedCount: c.usedCount }, data: { usedCount: { increment: 1 } } });
          if (!hit.count || (c.usageLimit != null && c.usedCount >= c.usageLimit)) throw fail(409, "This coupon has just been fully redeemed, remove it and try again");
          await tx.couponRedemption.create({ data: { couponId: c.id, orderId: o.id, phone: b.phone, amountPaise: priced.couponDiscount } });
        }
        await tx.cartItem.deleteMany({ where: { cartId: cartRow.id } });
        await tx.cart.update({ where: { id: cartRow.id }, data: { couponCode: null } });
        return o;
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return this.result((await this.db.order.findUniqueOrThrow({ where: { idempotencyKey: key }, select: { publicId: true } })).publicId);
      throw e;
    }

    if (online) {
      try {
        const r = await createRzpOrder(order.totalPaise, order.orderNumber);
        await this.db.payment.create({ data: { orderId: order.id, providerOrderId: r.id, method: "UPI", status: "CREATED", amountPaise: order.totalPaise } });
      } catch (e) {
        await this.cancel(order.id, "Payment provider error", "system");
        throw e;
      }
    }
    if (!online) void this.confirmation(order.id);
    return this.result(order.publicId);
  }

  private confirmation(orderId: string) { return this.messenger.send(orderId, "PLACED"); }

  /** Holds stock in the first warehouse that can cover the whole line. The CHECK constraint (reserved <= onHand) backs the WHERE clause. */
  private async reserve(tx: Tx, orderId: string, variantId: string, qty: number, expiresAt: Date) {
    const levels = await tx.inventoryLevel.findMany({ where: { variantId, warehouse: { isActive: true } }, orderBy: { warehouseId: "asc" } });
    for (const l of levels) {
      const n = await tx.$executeRaw`UPDATE "InventoryLevel" SET reserved = reserved + ${qty}, version = version + 1 WHERE "variantId" = ${variantId} AND "warehouseId" = ${l.warehouseId} AND "onHand" - reserved >= ${qty}`;
      if (n) return void (await tx.stockReservation.create({ data: { variantId, warehouseId: l.warehouseId, qty, orderId, expiresAt } }));
    }
    throw fail(409, "Sorry, an item just went out of stock");
  }

  /** Public order view; the unguessable publicId is the credential. */
  async result(publicId: string) {
    const o = await this.db.order.findUnique({
      where: { publicId },
      include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 }, shipments: { include: { events: { orderBy: { at: "asc" } } } }, events: { orderBy: { createdAt: "asc" } } },
    });
    if (!o) return null;
    const pay = o.payments[0];
    const retry = o.status === "PENDING_PAYMENT" && pay?.providerOrderId && pay.status === "CREATED" ? { keyId: env.RAZORPAY_KEY_ID, orderId: pay.providerOrderId, amountPaise: pay.amountPaise } : null;
    return {
      orderNumber: o.orderNumber, publicId: o.publicId, status: o.status, createdAt: o.createdAt, paymentMethod: pay?.method === "COD" ? "COD" : "ONLINE", paymentStatus: pay?.status ?? null,
      subtotalPaise: o.subtotalPaise, discountPaise: o.discountPaise, shippingPaise: o.shippingPaise, taxPaise: o.taxPaise, totalPaise: o.totalPaise,
      shippingAddress: o.shippingAddress, retry, deliveredAt: o.deliveredAt, invoiceNumber: o.invoiceNumber,
      items: o.items.map((i) => ({ title: i.title, variantTitle: i.variantTitle, imageUrl: i.imageUrl, qty: i.qty, totalPaise: i.totalPaise, engraving: i.engraving })),
      shipments: o.shipments.map((s) => ({ courier: s.courier, awb: s.awb, trackingUrl: s.trackingUrl, status: s.status, events: s.events.map((e) => ({ status: e.status, location: e.location, at: e.at })) })),
      timeline: o.events.map((e) => ({ type: e.type, message: e.message, at: e.createdAt })),
    };
  }

  async track(orderNumber: string, phone: string) {
    const o = await this.db.order.findFirst({ where: { orderNumber, phone }, select: { publicId: true } });
    return o ? this.result(o.publicId) : null;
  }

  /** Idempotent: safe to call from both the browser callback and the webhook. */
  async markPaid(providerOrderId: string, providerPaymentId: string, method: "UPI" | "CARD" | "NETBANKING" | "WALLET" = "UPI") {
    const pay = await this.db.payment.findUnique({ where: { providerOrderId }, include: { order: true } });
    if (!pay || pay.status === "CAPTURED" || pay.status === "REFUNDED") return;
    if (pay.order.status === "CANCELLED") { // paid after the hold expired: give the money back instead of fulfilling a released order
      await this.db.payment.update({ where: { id: pay.id }, data: { status: "CAPTURED", providerPaymentId, method } });
      await this.refund(pay.id, "Order expired before payment arrived", "system");
      return;
    }
    await this.db.$transaction([
      this.db.payment.update({ where: { id: pay.id }, data: { status: "CAPTURED", providerPaymentId, method } }),
      this.db.order.update({ where: { id: pay.orderId }, data: { status: "PLACED", placedAt: new Date(), paymentMethod: method } }),
      this.db.stockReservation.updateMany({ where: { orderId: pay.orderId, releasedAt: null }, data: { expiresAt: new Date(Date.now() + YEAR_MS) } }),
      this.db.orderEvent.create({ data: { orderId: pay.orderId, type: "paid", message: "Payment received", actor: "system" } }),
    ]);
    void this.confirmation(pay.orderId);
  }

  async markFailed(providerOrderId: string, code: string) {
    await this.db.payment.updateMany({ where: { providerOrderId, status: "CREATED" }, data: { status: "FAILED", failureCode: code.slice(0, 80) } });
  }

  /** Cancels a not-yet-shipped order, frees its stock and coupon use, and refunds any captured online payment. */
  async cancel(orderId: string, reason: string, actor: string) {
    const o = await this.db.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!o) throw fail(404, "Order not found");
    if (!canCancel(o.status)) throw fail(409, `A ${o.status.toLowerCase().replace("_", " ")} order can't be cancelled`);
    await this.db.$transaction(async (tx) => {
      await this.releaseStock(tx, orderId);
      const red = await tx.couponRedemption.findMany({ where: { orderId } });
      for (const r of red) await tx.coupon.update({ where: { id: r.couponId }, data: { usedCount: { decrement: 1 } } });
      await tx.couponRedemption.deleteMany({ where: { orderId } });
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelReason: reason } });
      await tx.orderEvent.create({ data: { orderId, type: "cancelled", message: reason, actor } });
    });
    const paid = o.payments.find((p) => p.status === "CAPTURED");
    if (paid) await this.refund(paid.id, reason, actor);
    void this.messenger.send(orderId, "CANCELLED", { note: reason });
  }

  /**
   * Refunds `amountPaise` (default: all that's left) of a payment. The payment row is locked so two refunds can never add up to more than was paid.
   * Online payments go back through Razorpay; anything that fails stays PENDING_MANUAL for staff. COD refunds are paid out by staff (PENDING_PAYOUT).
   */
  async refund(paymentId: string, reason: string, actor: string, opts: { amountPaise?: number; returnId?: string; method?: "ORIGINAL" | "UPI" | "BANK" } = {}) {
    const staffId = actor === "system" || actor === "customer" ? null : actor;
    const manual = opts.method === "UPI" || opts.method === "BANK";
    const created = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
      const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { refunds: true } });
      const done = p.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amountPaise, 0);
      const amount = opts.amountPaise ?? p.amountPaise - done;
      if (amount <= 0 || done + amount > p.amountPaise) throw fail(409, "That refund is more than what was paid");
      const r = await tx.refund.create({ data: { paymentId, amountPaise: amount, reason, status: manual ? "PENDING_PAYOUT" : "PENDING", staffId, returnId: opts.returnId ?? null, method: opts.method ?? "ORIGINAL" } });
      return { r, p, amount, total: done + amount };
    });
    const { r, p, amount, total } = created;
    if (manual) {
      await this.db.orderEvent.create({ data: { orderId: p.orderId, type: "refund", message: `Refund of ₹${(amount / 100).toFixed(2)} awaiting payout to the customer`, actor } });
      return r;
    }
    let providerRefundId: string | null = null, status = "PENDING_MANUAL";
    if (p.providerPaymentId && razorpayEnabled()) {
      try { providerRefundId = (await refundRzp(p.providerPaymentId, amount)).id; status = "PROCESSED"; } catch { /* left PENDING_MANUAL so staff can retry from the provider dashboard */ }
    }
    await this.db.$transaction([
      this.db.refund.update({ where: { id: r.id }, data: { status, providerRefundId, paidAt: status === "PROCESSED" ? new Date() : null } }),
      ...(status === "PROCESSED" ? [this.db.payment.update({ where: { id: paymentId }, data: { status: total >= p.amountPaise ? "REFUNDED" : "PARTIALLY_REFUNDED" } })] : []),
      this.db.orderEvent.create({ data: { orderId: p.orderId, type: "refund", message: status === "PROCESSED" ? `Refund of ₹${(amount / 100).toFixed(2)} initiated` : "Refund needs manual processing", actor } }),
    ]);
    if (status === "PROCESSED") void this.messenger.send(p.orderId, "REFUND_PROCESSED", { amount: `₹${(amount / 100).toFixed(2)}`, note: reason });
    return this.db.refund.findUniqueOrThrow({ where: { id: r.id } });
  }

  private async releaseStock(tx: Tx, orderId: string) {
    const held = await tx.stockReservation.findMany({ where: { orderId, releasedAt: null } });
    for (const r of held) {
      await tx.$executeRaw`UPDATE "InventoryLevel" SET reserved = reserved - ${r.qty}, version = version + 1 WHERE "variantId" = ${r.variantId} AND "warehouseId" = ${r.warehouseId}`;
      await tx.stockReservation.update({ where: { id: r.id }, data: { releasedAt: new Date() } });
    }
  }

  /** Throws 404/409 unless the order may take this step now. Called before any outside booking so a bad click never books a courier. */
  async assertCanAdvance(orderId: string, to: Step) {
    const o = await this.db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!o) throw fail(404, "Order not found");
    if (!canAdvance(o.status, to)) throw fail(409, `Order is ${o.status.toLowerCase().replace("_", " ")}; it can't move to ${to.toLowerCase()}`);
  }

  /** Staff moves an order forward. Shipping converts the hold into a real stock deduction. */
  async advance(orderId: string, to: Step, staffId: string, ship?: { courier?: string | null; awb?: string; trackingUrl?: string; labelUrl?: string | null; providerOrderId?: string; providerShipmentId?: string }) {
    const o = await this.db.order.findUnique({ where: { id: orderId }, include: { items: true, payments: true } });
    if (!o) throw fail(404, "Order not found");
    if (!canAdvance(o.status, to)) throw fail(409, `Order is ${o.status.toLowerCase().replace("_", " ")}; it can't move to ${to.toLowerCase()}`);
    await this.db.$transaction(async (tx) => {
      if (to === "SHIPPED") {
        const held = await tx.stockReservation.findMany({ where: { orderId, releasedAt: null } });
        for (const r of held) {
          await tx.$executeRaw`UPDATE "InventoryLevel" SET "onHand" = "onHand" - ${r.qty}, reserved = reserved - ${r.qty}, version = version + 1 WHERE "variantId" = ${r.variantId} AND "warehouseId" = ${r.warehouseId}`;
          await tx.stockMovement.create({ data: { variantId: r.variantId, warehouseId: r.warehouseId, delta: -r.qty, reason: "SALE", refType: "Order", refId: orderId, staffId } });
          await tx.stockReservation.update({ where: { id: r.id }, data: { releasedAt: new Date() } });
        }
        const wh = held[0]?.warehouseId ?? (await tx.warehouse.findFirstOrThrow()).id;
        await tx.order.update({ where: { id: orderId }, data: { invoiceNumber: o.invoiceNumber ?? (await this.nextInvoiceNumber(tx)) } });
        await tx.shipment.create({ data: { orderId, warehouseId: wh, courier: ship?.courier ?? null, awb: ship?.awb || null, trackingUrl: ship?.trackingUrl ?? null, labelUrl: ship?.labelUrl ?? null, providerOrderId: ship?.providerOrderId ?? null, providerShipmentId: ship?.providerShipmentId ?? null, status: "IN_TRANSIT", shippedAt: new Date(), items: o.items.map((i) => ({ orderItemId: i.id, qty: i.qty })), events: { create: { status: "Shipped", at: new Date() } } } });
      }
      if (to === "DELIVERED") {
        await tx.shipment.updateMany({ where: { orderId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
        await tx.payment.updateMany({ where: { orderId, status: "COD_PENDING" }, data: { status: "COD_COLLECTED" } });
      }
      await tx.order.update({ where: { id: orderId }, data: { status: to, ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}) } });
      await tx.orderEvent.create({ data: { orderId, type: to.toLowerCase(), actor: staffId } });
    });
    if (to === "DELIVERED") {
      const rules = await this.settings.returnRules();
      void this.messenger.send(orderId, "DELIVERED", { windowEnds: new Date(Date.now() + rules.windowDays * 86_400_000).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) });
    } else void this.messenger.send(orderId, to === "PROCESSING" ? "PACKED" : to);
  }

  /** Gapless per financial year (April–March): the counter row is locked by the surrounding transaction. */
  private async nextInvoiceNumber(tx: Tx) {
    const now = new Date(), y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fy = `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
    const [row] = await tx.$queryRaw<{ n: number }[]>`INSERT INTO "Setting" (key, value, "updatedAt") VALUES (${`invoiceSeq:${fy}`}, '1'::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = to_jsonb((("Setting".value #>> '{}')::int) + 1), "updatedAt" = now() RETURNING (value #>> '{}')::int AS n`;
    return `INV/${fy}/${String(row!.n).padStart(6, "0")}`;
  }

  async expireStale() {
    const stale = await this.db.order.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(Date.now() - HOLD_MS) } }, select: { id: true } });
    for (const { id } of stale) await this.cancel(id, "Payment not completed in time", "system").catch((e) => this.log.warn(`expire ${id}: ${e}`));
    return stale.length;
  }
}
