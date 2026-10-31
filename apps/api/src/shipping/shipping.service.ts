import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Injectable, Logger, OnModuleDestroy, OnModuleInit, Post } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { CheckoutService } from "../checkout/checkout.service";
import { Perm, Public } from "../auth/auth.types";
import { env } from "../env";
import { OrderMessenger } from "../orders/messenger.service";
import { PrismaService } from "../prisma.service";
import { bookShipment, shiprocketEnabled, trackAwb } from "./shiprocket";
import { mapStatus } from "./status";

const HOUR = 3600_000;

@Injectable()
export class ShippingService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Shipping");
  private timer?: NodeJS.Timeout;
  constructor(private readonly db: PrismaService, private readonly checkout: CheckoutService, private readonly messenger: OrderMessenger) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.pollStale().catch((e) => this.log.error(e)), 30 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  enabled() { return shiprocketEnabled(); }

  /** Books the courier through Shiprocket. Call before advancing the order to SHIPPED. */
  async book(orderId: string) {
    const o = await this.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payments: { take: 1, orderBy: { createdAt: "desc" } } } });
    const weights = new Map((await this.db.variant.findMany({ where: { id: { in: o.items.flatMap((i) => (i.variantId ? [i.variantId] : [])) } }, select: { id: true, weightGrams: true } })).map((v) => [v.id, v.weightGrams]));
    const a = o.shippingAddress as { name: string; line1: string; line2?: string; city: string; state: string; pincode: string };
    const cod = o.payments[0]?.method === "COD";
    return bookShipment({
      orderNumber: o.orderNumber, placedAt: o.placedAt ?? o.createdAt, cod, totalPaise: o.totalPaise, shippingPaise: o.shippingPaise, discountPaise: o.discountPaise,
      customer: { name: a.name, phone: o.phone, email: o.email, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode },
      items: o.items.map((i) => ({ title: i.title, sku: i.sku, qty: i.qty, unitPricePaise: i.unitPricePaise, hsn: i.hsnCode })),
      weightGrams: o.items.reduce((n, i) => n + (weights.get(i.variantId ?? "") ?? 300) * i.qty, 0),
    });
  }

  /** One courier update, from the webhook or the poller. Idempotent: the same status+time is never stored twice. */
  async apply(awb: string, statusText: string, at: Date, location: string | null = null) {
    const sh = await this.db.shipment.findUnique({ where: { awb }, include: { order: true } });
    if (!sh) return false;
    if (await this.db.shipmentEvent.findFirst({ where: { shipmentId: sh.id, status: statusText, at } })) return true;
    const mapped = mapStatus(statusText);
    await this.db.$transaction([
      this.db.shipmentEvent.create({ data: { shipmentId: sh.id, status: statusText, location, at } }),
      ...(mapped && sh.status !== "DELIVERED" ? [this.db.shipment.update({ where: { id: sh.id }, data: { status: mapped } })] : []),
      ...(mapped === "RTO" && sh.status !== "RTO" ? [this.db.orderEvent.create({ data: { orderId: sh.orderId, type: "rto", message: "Delivery failed, the courier is returning the parcel", actor: "courier" } })] : []),
    ]);
    if (mapped === "RTO" && sh.status !== "RTO") void this.messenger.alertAdmin(sh.orderId, "Delivery failed (returning to you)", `Courier status: ${statusText}`);
    if (mapped === "OFD" && sh.status !== "OFD") void this.messenger.send(sh.orderId, "OUT_FOR_DELIVERY");
    if (mapped === "DELIVERED" && sh.order.status === "SHIPPED") await this.checkout.advance(sh.orderId, "DELIVERED", "courier");
    return true;
  }

  /** Webhooks get lost: ask the courier about any shipment that has been silent for a day. */
  async pollStale() {
    if (!shiprocketEnabled()) return 0;
    const cutoff = new Date(Date.now() - 24 * HOUR);
    const rows = await this.db.shipment.findMany({ where: { awb: { not: null }, providerShipmentId: { not: null }, status: { notIn: ["DELIVERED", "RTO"] }, shippedAt: { lt: cutoff }, events: { none: { at: { gt: cutoff } } } }, select: { awb: true }, take: 50 });
    for (const r of rows) {
      try { for (const e of await trackAwb(r.awb!)) await this.apply(r.awb!, e.status, e.at, e.location); } catch (e) { this.log.warn(`poll ${r.awb}: ${e}`); }
    }
    return rows.length;
  }
}

const same = (a?: string, b?: string) => !!a && !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@Controller()
export class ShippingController {
  constructor(private readonly svc: ShippingService, private readonly db: PrismaService) {}

  @Get("admin/shipping/config") @Perm("order:read")
  config() { return { auto: this.svc.enabled() }; }

  @Public() @Post("webhooks/shiprocket") @HttpCode(200)
  async webhook(@Headers("x-api-key") key: string | undefined, @Body() b: { awb?: string; current_status?: string; current_timestamp?: string; scans?: { location?: string }[] }) {
    if (!env.SHIPROCKET_WEBHOOK_TOKEN || !same(key, env.SHIPROCKET_WEBHOOK_TOKEN)) throw new BadRequestException({ title: "Invalid webhook token" });
    if (!b?.awb || !b.current_status) return { ok: true, ignored: true };
    const at = b.current_timestamp ? new Date(b.current_timestamp.replace(" ", "T") + "+05:30") : new Date();
    await this.svc.apply(b.awb, b.current_status, Number.isNaN(at.getTime()) ? new Date() : at, b.scans?.[0]?.location ?? null);
    return { ok: true };
  }
}
