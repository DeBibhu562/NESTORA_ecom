import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { hasPerm } from "../auth/auth.guard";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";
import { OrderMessenger } from "../orders/messenger.service";
import { invoiceView } from "../orders/invoice";
import { SettingsService } from "../settings/settings.service";
import { ShippingService } from "../shipping/shipping.service";
import { CheckoutService } from "./checkout.service";

const STATUSES = ["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const listDto = z.object({ status: z.enum(STATUSES).optional(), delayed: z.coerce.boolean().optional(), q: z.string().trim().max(40).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });
const advanceDto = z.object({ to: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]), courier: z.string().trim().max(60).optional(), awb: z.string().trim().max(60).optional(), trackingUrl: z.string().url().max(300).optional() });
const noteDto = z.object({ note: z.string().trim().max(1000) });
const resendDto = z.object({ template: z.enum(["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) });
const cancelDto = z.object({ reason: z.string().trim().min(3).max(200) });

const maskPhone = (p: string) => p.replace(/\d(?=\d{3})/g, "•");
const maskEmail = (e: string | null) => (e ? e.replace(/^(.).*(@.*)$/, "$1•••$2") : null);

@Controller("admin/orders")
export class OrdersAdminController {
  constructor(private readonly db: PrismaService, private readonly svc: CheckoutService, private readonly shipping: ShippingService, private readonly settings: SettingsService, private readonly messenger: OrderMessenger, private readonly audit: AuditService) {}

  @Get() @Perm("order:read")
  async list(@Query(new ZodPipe(listDto)) q: z.infer<typeof listDto>, @Staff() s: StaffClaims) {
    const reveal = hasPerm(s.perms, "customer:reveal");
    const day2 = new Date(Date.now() - 2 * 86_400_000);
    const where = { ...(q.status && { status: q.status }), ...(q.delayed && { OR: [{ status: { in: ["PLACED", "CONFIRMED", "PROCESSING"] as never[] }, createdAt: { lt: day2 } }, { status: "SHIPPED" as never, shipments: { some: { status: { not: "DELIVERED" }, events: { none: { at: { gt: day2 } } } } } }] }), ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: new Date(q.to.getTime() + 86_399_999) }) } }), ...(q.q && { OR: [{ orderNumber: { contains: q.q.toUpperCase() } }, { phone: { contains: q.q } }] }) };
    const rows = await this.db.order.findMany({ where, take: q.limit + 1, orderBy: { createdAt: "desc" }, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, orderNumber: true, status: true, phone: true, totalPaise: true, createdAt: true, shippingAddress: true, payments: { select: { method: true, status: true }, take: 1, orderBy: { createdAt: "desc" } } } });
    const next = rows.length > q.limit ? rows.pop()!.id : null;
    return { items: rows.map(({ shippingAddress, ...r }) => ({ ...r, name: (shippingAddress as { name?: string } | null)?.name ?? null, city: (shippingAddress as { city?: string } | null)?.city ?? null, phone: reveal ? r.phone : maskPhone(r.phone) })), nextCursor: next };
  }

  /** Counts for the inbox tabs. "Stuck" = shipped with no courier update for 2 days, or unshipped for 2 days after confirmation. */
  @Get("queues") @Perm("order:read")
  async queues() {
    const day2 = new Date(Date.now() - 2 * 86_400_000);
    const [byStatus, stuckShip, stuckPack, returns, payouts] = await Promise.all([
      this.db.order.groupBy({ by: ["status"], _count: true }),
      this.db.order.count({ where: { status: "SHIPPED", shipments: { some: { status: { notIn: ["DELIVERED"] }, events: { none: { at: { gt: day2 } } } } } } }),
      this.db.order.count({ where: { status: { in: ["PLACED", "CONFIRMED", "PROCESSING"] }, createdAt: { lt: day2 } } }),
      this.db.returnRequest.count({ where: { status: { in: ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "RECEIVED"] } } }),
      this.db.refund.count({ where: { status: { in: ["PENDING_PAYOUT", "PENDING_MANUAL"] } } }),
    ]);
    const n = (...st: string[]) => byStatus.filter((b) => st.includes(b.status)).reduce((a, b) => a + b._count, 0);
    return { new: n("PLACED"), toPack: n("CONFIRMED"), toShip: n("PROCESSING"), inTransit: n("SHIPPED", "PARTIALLY_SHIPPED"), delivered: n("DELIVERED"), delayed: stuckShip + stuckPack, returns, refunds: payouts };
  }

  @Get(":id/invoice") @Perm("order:read")
  async invoice(@Param("id") id: string) {
    const o = await this.db.order.findUnique({ where: { id }, include: { items: true, shipments: { orderBy: { shippedAt: "asc" }, take: 1 } } });
    if (!o?.invoiceNumber) throw new NotFoundException({ title: "This order has no invoice yet. It is created when the order ships." });
    return invoiceView({ ...o, invoiceNumber: o.invoiceNumber, date: o.shipments[0]?.shippedAt ?? o.placedAt ?? o.createdAt, shippingAddress: o.shippingAddress as never }, await this.settings.business());
  }

  @Post(":id/note") @Perm("order:write") @HttpCode(200)
  async note(@Param("id") id: string, @Body(new ZodPipe(noteDto)) b: z.infer<typeof noteDto>, @Staff() s: StaffClaims) {
    await this.db.order.update({ where: { id }, data: { internalNote: b.note || null } });
    await this.audit.log(s.id, "order.note", "Order", id, {});
    return { ok: true };
  }

  @Post(":id/resend") @Perm("order:write") @HttpCode(200)
  async resend(@Param("id") id: string, @Body(new ZodPipe(resendDto)) b: z.infer<typeof resendDto>) {
    await this.messenger.send(id, b.template);
    return { ok: true };
  }

  @Get(":id") @Perm("order:read")
  async one(@Param("id") id: string, @Staff() s: StaffClaims) {
    const o = await this.db.order.findUnique({ where: { id }, include: { items: true, payments: { include: { refunds: true } }, shipments: { include: { events: { orderBy: { at: "asc" } } } }, events: { orderBy: { createdAt: "asc" } }, messages: { orderBy: { createdAt: "desc" }, take: 30 }, returns: { orderBy: { createdAt: "desc" }, select: { id: true, returnNumber: true, status: true, reason: true, refundPaise: true, createdAt: true } } } });
    if (!o) throw new NotFoundException();
    if (hasPerm(s.perms, "customer:reveal")) return o;
    const { shippingAddress, billingAddress, ...rest } = o;
    const hide = (a: unknown) => ({ ...(a as Record<string, string>), phone: maskPhone(String((a as { phone?: string }).phone ?? "")), line1: "•••", line2: undefined, landmark: undefined });
    return { ...rest, phone: maskPhone(o.phone), email: maskEmail(o.email), shippingAddress: hide(shippingAddress), billingAddress: hide(billingAddress) };
  }

  @Post(":id/advance") @Perm("order:write") @HttpCode(200)
  async advance(@Param("id") id: string, @Body(new ZodPipe(advanceDto)) b: z.infer<typeof advanceDto>, @Staff() s: StaffClaims) {
    // No AWB typed in and Shiprocket is connected: book the courier automatically. Typing an AWB always means "I booked it myself".
    await this.svc.assertCanAdvance(id, b.to);
    const booked = b.to === "SHIPPED" && !b.awb && this.shipping.enabled() ? await this.shipping.book(id) : undefined;
    await this.svc.advance(id, b.to, s.id, booked ?? b);
    await this.audit.log(s.id, "order.advance", "Order", id, b);
    return { ok: true };
  }

  @Post(":id/cancel") @Perm("order:write", "order:refund") @HttpCode(200)
  async cancel(@Param("id") id: string, @Body(new ZodPipe(cancelDto)) b: z.infer<typeof cancelDto>, @Staff() s: StaffClaims) {
    await this.svc.cancel(id, b.reason, s.id);
    await this.audit.log(s.id, "order.cancel", "Order", id, b);
    return { ok: true };
  }
}
