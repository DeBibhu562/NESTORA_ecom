import { HttpException, Injectable } from "@nestjs/common";
import { CheckoutService } from "../checkout/checkout.service";
import { daysLeft, refundAmount, returnProblem, windowEnds, FAULT, type Asked, type Reason } from "../orders/lifecycle";
import { OrderMessenger } from "../orders/messenger.service";
import { PrismaService } from "../prisma.service";
import { SettingsService } from "../settings/settings.service";
import { seal, unseal } from "./secret";

const fail = (status: number, title: string) => new HttpException({ title }, status);
const OPEN = ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "RECEIVED", "REFUNDED"]; // everything that still counts against the quantity delivered
const rs = (p: number) => `₹${(p / 100).toFixed(2)}`;

export type NewReturn = { reason: Reason; details?: string; items: Asked[]; photos: string[]; refundMethod?: "UPI" | "BANK"; refundDetails?: string };

@Injectable()
export class ReturnsService {
  constructor(private readonly db: PrismaService, private readonly checkout: CheckoutService, private readonly messenger: OrderMessenger, private readonly settings: SettingsService) {}

  private async order(publicId: string) {
    const o = await this.db.order.findUnique({ where: { publicId }, include: { items: true, payments: { orderBy: { createdAt: "desc" } }, returns: true } });
    if (!o) throw fail(404, "Order not found");
    return o;
  }

  private returned(o: { returns: { status: string; items: unknown }[] }, itemId: string) {
    return o.returns.filter((r) => OPEN.includes(r.status)).flatMap((r) => r.items as Asked[]).filter((i) => i.orderItemId === itemId).reduce((n, i) => n + i.qty, 0);
  }

  /** What the customer's order page needs: is the window open, how long is left, and what can still be returned. */
  async options(publicId: string) {
    const o = await this.order(publicId), rules = await this.settings.returnRules();
    const eligible = o.status === "DELIVERED" && !!o.deliveredAt && new Date() <= windowEnds(o.deliveredAt, rules);
    return {
      eligible, windowDays: rules.windowDays, daysLeft: o.deliveredAt ? daysLeft(o.deliveredAt, rules) : null, windowEnds: o.deliveredAt ? windowEnds(o.deliveredAt, rules) : null, cod: o.payments[0]?.method === "COD",
      lines: o.items.map((i) => ({ id: i.id, title: i.title, variantTitle: i.variantTitle, imageUrl: i.imageUrl, qty: i.qty, engraved: !!i.engraving, returnable: i.qty - this.returned(o, i.id) })),
      returns: o.returns.sort((a, b) => +b.createdAt - +a.createdAt).map((r) => ({ returnNumber: r.returnNumber, status: r.status, reason: r.reason, refundPaise: r.refundPaise, rejectReason: r.rejectReason, createdAt: r.createdAt })),
    };
  }

  async request(publicId: string, b: NewReturn) {
    const o = await this.order(publicId), rules = await this.settings.returnRules();
    const lines = o.items.map((i) => ({ id: i.id, qty: i.qty, engraving: i.engraving, alreadyReturned: this.returned(o, i.id) }));
    const problem = returnProblem(o, lines, b.items, b.reason, rules);
    if (problem) throw fail(409, problem);
    if (FAULT.includes(b.reason) && b.photos.length === 0) throw fail(400, "Please add at least one photo so we can review the problem");
    const pay = o.payments.find((p) => ["CAPTURED", "PARTIALLY_REFUNDED", "COD_COLLECTED"].includes(p.status));
    if (!pay) throw fail(409, "This order has no completed payment to refund");
    const cod = pay.method === "COD";
    if (cod && !b.refundMethod) throw fail(400, "Tell us where to send your refund (UPI id or bank details)");
    const money = refundAmount(o, o.items.map((i) => ({ id: i.id, qty: i.qty, totalPaise: i.totalPaise, alreadyReturned: this.returned(o, i.id) })), b.items, b.reason, rules);

    const ret = await this.db.$transaction(async (tx) => {
      const [seq] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('return_seq') AS n`;
      return tx.returnRequest.create({
        data: {
          returnNumber: `RET-${seq!.n}`, orderId: o.id, type: "RETURN", reason: b.reason, details: b.details?.trim() || null, status: "REQUESTED", items: b.items, photos: b.photos,
          refundPaise: money, refundMethod: cod ? b.refundMethod : "ORIGINAL", refundDetails: cod && b.refundDetails ? seal(b.refundDetails.trim()) : null,
          events: { create: { type: "requested", message: `Requested by customer (${b.reason.toLowerCase().replace("_", " ")})`, actor: "customer" } },
        },
      });
    });
    await this.db.orderEvent.create({ data: { orderId: o.id, type: "return", message: `Return ${ret.returnNumber} requested`, actor: "customer" } });
    void this.messenger.send(o.id, "RETURN_REQUESTED", { returnNumber: ret.returnNumber });
    void this.messenger.alertAdmin(o.id, `Return requested (${ret.returnNumber})`, `Reason: ${b.reason.toLowerCase().replace("_", " ")}${b.details ? ` - ${b.details}` : ""}\nReview it under Returns in admin.`);
    return ret;
  }

  // ───────── staff ─────────

  list(q: { status?: string; q?: string }) {
    return this.db.returnRequest.findMany({
      where: { ...(q.status && { status: q.status }), ...(q.q && { OR: [{ returnNumber: { contains: q.q.toUpperCase() } }, { order: { orderNumber: { contains: q.q.toUpperCase() } } }] }) },
      orderBy: { createdAt: "desc" }, take: 100, include: { order: { select: { orderNumber: true, phone: true, shippingAddress: true } } },
    });
  }

  async get(id: string, reveal: boolean) {
    const r = await this.db.returnRequest.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "asc" } }, order: { include: { items: true, payments: { include: { refunds: true } } } } } });
    if (!r) throw fail(404, "Return not found");
    const { refundDetails, ...rest } = r;
    return { ...rest, refundDetails: reveal ? unseal(refundDetails) : refundDetails ? "••••••" : null };
  }

  private async move(id: string, from: string[], to: string, actor: string, message: string, data: Record<string, unknown> = {}) {
    const hit = await this.db.returnRequest.updateMany({ where: { id, status: { in: from } }, data: { status: to, decidedBy: actor, decidedAt: new Date(), ...data } });
    if (!hit.count) throw fail(409, "This return can't be moved to that step right now");
    await this.db.returnEvent.create({ data: { returnId: id, type: to.toLowerCase(), message, actor } });
    return this.db.returnRequest.findUniqueOrThrow({ where: { id } });
  }

  async approve(id: string, actor: string, pickup?: { awb?: string; note?: string }) {
    const r = await this.move(id, ["REQUESTED"], pickup?.awb ? "PICKUP_SCHEDULED" : "APPROVED", actor, pickup?.awb ? `Approved, pickup booked (AWB ${pickup.awb})` : "Approved", { pickupAwb: pickup?.awb ?? null });
    void this.messenger.send(r.orderId, "RETURN_APPROVED", { returnNumber: r.returnNumber, note: pickup?.note });
    return r;
  }

  async schedulePickup(id: string, actor: string, awb: string) { return this.move(id, ["APPROVED"], "PICKUP_SCHEDULED", actor, `Pickup booked (AWB ${awb})`, { pickupAwb: awb }); }

  async reject(id: string, actor: string, reason: string) {
    const r = await this.move(id, ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "RECEIVED"], "REJECTED", actor, reason, { rejectReason: reason });
    void this.messenger.send(r.orderId, "RETURN_REJECTED", { returnNumber: r.returnNumber, note: reason });
    return r;
  }

  /** Staff has the parcel: decide per item whether it goes back on the shelf or is written off. Stock is never restored automatically. */
  async receive(id: string, actor: string, decisions: { orderItemId: string; restock: boolean }[]) {
    const cur = await this.db.returnRequest.findUnique({ where: { id }, include: { order: { include: { items: true, shipments: { take: 1, orderBy: { shippedAt: "desc" } } } } } });
    if (!cur) throw fail(404, "Return not found");
    const asked = cur.items as Asked[];
    if (!asked.every((a) => decisions.some((d) => d.orderItemId === a.orderItemId))) throw fail(400, "Choose restock or write-off for every returned item");
    await this.move(id, ["APPROVED", "PICKUP_SCHEDULED"], "RECEIVED", actor, `Received. ${decisions.filter((d) => d.restock).length} item(s) restocked, ${decisions.filter((d) => !d.restock).length} written off`);
    const wh = cur.order.shipments[0]?.warehouseId ?? (await this.db.warehouse.findFirstOrThrow({ where: { isActive: true } })).id;
    await this.db.$transaction(async (tx) => {
      for (const a of asked) {
        const item = cur.order.items.find((i) => i.id === a.orderItemId);
        if (!item?.variantId || !decisions.find((d) => d.orderItemId === a.orderItemId)?.restock) continue;
        await tx.$executeRaw`UPDATE "InventoryLevel" SET "onHand" = "onHand" + ${a.qty}, version = version + 1 WHERE "variantId" = ${item.variantId} AND "warehouseId" = ${wh}`;
        await tx.stockMovement.create({ data: { variantId: item.variantId, warehouseId: wh, delta: a.qty, reason: "RETURN", refType: "Return", refId: id, staffId: actor } });
      }
    });
    void this.messenger.send(cur.orderId, "RETURN_RECEIVED", { returnNumber: cur.returnNumber });
  }

  /** Pays the refund (original method for online orders; a payout task for COD) and, when everything is back, closes the order as RETURNED. */
  async refund(id: string, actor: string, amountPaise?: number) {
    const r = await this.db.returnRequest.findUnique({ where: { id }, include: { order: { include: { items: true, payments: { orderBy: { createdAt: "desc" } }, returns: true } } } });
    if (!r) throw fail(404, "Return not found");
    if (r.status !== "RECEIVED") throw fail(409, "Mark the parcel as received before refunding");
    const max = r.refundPaise ?? 0, amount = amountPaise ?? max;
    if (amount < 1 || amount > max) throw fail(400, `Refund must be between ₹0.01 and ${rs(max)}`);
    const pay = r.order.payments.find((p) => ["CAPTURED", "PARTIALLY_REFUNDED", "COD_COLLECTED"].includes(p.status));
    if (!pay) throw fail(409, "No completed payment to refund");
    const method = pay.method === "COD" ? ((r.refundMethod as "UPI" | "BANK") ?? "UPI") : "ORIGINAL";
    const hit = await this.db.returnRequest.updateMany({ where: { id, status: "RECEIVED" }, data: { status: "REFUNDED", refundPaise: amount, decidedBy: actor, decidedAt: new Date() } });
    if (!hit.count) throw fail(409, "This return was just refunded");
    try { await this.checkout.refund(pay.id, `Return ${r.returnNumber}`, actor, { amountPaise: amount, returnId: id, method }); }
    catch (e) { await this.db.returnRequest.update({ where: { id }, data: { status: "RECEIVED" } }); throw e; } // nothing was paid out, let staff retry
    await this.db.returnEvent.create({ data: { returnId: id, type: "refunded", message: `Refund of ${rs(amount)} ${method === "ORIGINAL" ? "sent to the original payment method" : "queued for payout"}`, actor } });
    const all = await this.db.returnRequest.findMany({ where: { orderId: r.orderId, status: "REFUNDED" } });
    const back = all.flatMap((x) => x.items as Asked[]).reduce((n, i) => n + i.qty, 0);
    if (back >= r.order.items.reduce((n, i) => n + i.qty, 0)) {
      await this.db.order.update({ where: { id: r.orderId }, data: { status: "RETURNED" } });
      await this.db.orderEvent.create({ data: { orderId: r.orderId, type: "returned", message: "All items returned", actor } });
    }
    return this.db.returnRequest.findUniqueOrThrow({ where: { id } });
  }

  // ───────── COD payouts ─────────
  payouts(reveal: boolean) {
    return this.db.refund.findMany({ where: { status: "PENDING_PAYOUT" }, orderBy: { createdAt: "asc" }, include: { payment: { select: { order: { select: { orderNumber: true, phone: true, shippingAddress: true } } } } } })
      .then(async (rows) => {
        const rets = await this.db.returnRequest.findMany({ where: { id: { in: rows.flatMap((x) => (x.returnId ? [x.returnId] : [])) } }, select: { id: true, returnNumber: true, refundMethod: true, refundDetails: true } });
        return rows.map((x) => { const rt = rets.find((y) => y.id === x.returnId); return { id: x.id, amountPaise: x.amountPaise, createdAt: x.createdAt, orderNumber: x.payment.order.orderNumber, returnNumber: rt?.returnNumber ?? null, method: rt?.refundMethod ?? x.method, details: reveal ? unseal(rt?.refundDetails ?? null) : "••••••", name: (x.payment.order.shippingAddress as { name?: string }).name ?? null }; });
      });
  }

  async markPaid(refundId: string, actor: string, utr: string) {
    const x = await this.db.refund.findUnique({ where: { id: refundId }, include: { payment: { include: { refunds: true } } } });
    if (!x) throw fail(404, "Refund not found");
    const hit = await this.db.refund.updateMany({ where: { id: refundId, status: "PENDING_PAYOUT" }, data: { status: "PAID", utr, paidAt: new Date(), staffId: actor } });
    if (!hit.count) throw fail(409, "This payout was already marked as paid");
    const total = x.payment.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amountPaise, 0);
    await this.db.payment.update({ where: { id: x.paymentId }, data: { status: total >= x.payment.amountPaise ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    await this.db.orderEvent.create({ data: { orderId: x.payment.orderId, type: "refund", message: `Refund of ${rs(x.amountPaise)} paid (ref ${utr})`, actor } });
    void this.messenger.send(x.payment.orderId, "REFUND_PROCESSED", { amount: rs(x.amountPaise), note: `Reference: ${utr}.` });
  }
}
