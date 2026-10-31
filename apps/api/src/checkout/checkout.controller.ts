import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpException, NotFoundException, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { Public } from "../auth/auth.types";
import { Limiter } from "../common/limiter.service";
import { ZodPipe } from "../common/zod.pipe";
import { env } from "../env";
import { userIdFrom } from "../customer/customer-auth.service";
import { invoiceView } from "../orders/invoice";
import { PrismaService } from "../prisma.service";
import { SettingsService } from "../settings/settings.service";
import { CheckoutService } from "./checkout.service";
import { validSignature } from "./razorpay";

const text = (max: number) => z.string().trim().min(1).max(max);
const checkoutDto = z.object({
  name: text(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number").transform((p) => `+91${p}`),
  email: z.string().trim().email().max(120).optional().or(z.literal("").transform(() => undefined)),
  paymentMethod: z.enum(["COD", "ONLINE"]),
  address: z.object({ line1: text(120), line2: z.string().trim().max(120).optional(), landmark: z.string().trim().max(80).optional(), city: text(60), pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a 6-digit pincode") }),
});
const verifyDto = z.object({ razorpay_order_id: z.string().max(60), razorpay_payment_id: z.string().max(60), razorpay_signature: z.string().max(200) });
const trackDto = z.object({ orderNumber: z.string().trim().toUpperCase().max(30), phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number").transform((p) => `+91${p}`) });
const METHODS = { card: "CARD", upi: "UPI", netbanking: "NETBANKING", wallet: "WALLET" } as const;


@Public()
@Controller()
export class CheckoutController {
  constructor(private readonly svc: CheckoutService, private readonly db: PrismaService, private readonly limiter: Limiter, private readonly settings: SettingsService) {}

  @Get("checkout/config") config() { return this.svc.config(); }

  @Post("checkout/orders") @HttpCode(200)
  async place(@Body(new ZodPipe(checkoutDto)) b: z.infer<typeof checkoutDto>, @Headers("idempotency-key") key: string | undefined, @Req() req: Request) {
    await this.limiter.guard(`order:${req.ip}`, 10, 60_000, "Too many attempts, please wait a minute");
    await this.limiter.guard(`orderphone:${b.phone}`, process.env.NODE_ENV === "test" ? 1000 : 5, 86_400_000, "Too many orders from this phone number today. Please contact support.");
    if (!key || !/^[\w-]{8,64}$/.test(key)) throw new BadRequestException({ title: "Idempotency-Key header is required" });
    return this.svc.place(req.cookies?.ct, key, b, userIdFrom(req));
  }

  /** Browser callback after Razorpay checkout. The signature proves the payment; the webhook is the backstop if the tab closes first. */
  @Post("checkout/verify") @HttpCode(200)
  async verify(@Body(new ZodPipe(verifyDto)) b: z.infer<typeof verifyDto>) {
    if (!validSignature(`${b.razorpay_order_id}|${b.razorpay_payment_id}`, b.razorpay_signature, env.RAZORPAY_KEY_SECRET)) throw new BadRequestException({ title: "Payment signature is invalid" });
    await this.svc.markPaid(b.razorpay_order_id, b.razorpay_payment_id);
    const p = await this.db.payment.findUnique({ where: { providerOrderId: b.razorpay_order_id }, select: { order: { select: { publicId: true } } } });
    return this.svc.result(p?.order.publicId ?? "");
  }

  @Post("webhooks/razorpay") @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers("x-razorpay-signature") sig?: string, @Headers("x-razorpay-event-id") eventId?: string) {
    if (!req.rawBody || !eventId || !validSignature(req.rawBody, sig, env.RAZORPAY_WEBHOOK_SECRET)) throw new BadRequestException({ title: "Invalid webhook signature" });
    const body = JSON.parse(req.rawBody.toString()) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; method?: string; error_code?: string } } } };
    const seen = await this.db.webhookEvent.findUnique({ where: { provider_eventId: { provider: "razorpay", eventId } } });
    if (seen?.processedAt) return { ok: true, duplicate: true };
    const row = seen ?? await this.db.webhookEvent.create({ data: { provider: "razorpay", eventId, type: body.event, payload: body as object } });
    try {
      const pay = body.payload?.payment?.entity;
      if (pay?.order_id) {
        if (body.event === "payment.captured") await this.svc.markPaid(pay.order_id, pay.id, METHODS[pay.method as keyof typeof METHODS] ?? "UPI");
        else if (body.event === "payment.failed") await this.svc.markFailed(pay.order_id, pay.error_code ?? "failed");
      }
      await this.db.webhookEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), error: null } });
    } catch (e) {
      await this.db.webhookEvent.update({ where: { id: row.id }, data: { error: String(e).slice(0, 500) } });
      throw e; // 5xx makes Razorpay retry
    }
    return { ok: true };
  }

  @Get("orders/:publicId")
  async order(@Param("publicId") id: string) {
    return (await this.svc.result(id.slice(0, 64))) ?? Promise.reject(new NotFoundException({ title: "Order not found" }));
  }

  @Get("orders/:publicId/invoice")
  async invoice(@Param("publicId") id: string) {
    const o = await this.db.order.findUnique({ where: { publicId: id.slice(0, 64) }, include: { items: true, shipments: { orderBy: { shippedAt: "asc" }, take: 1 } } });
    if (!o?.invoiceNumber) throw new NotFoundException({ title: "Your invoice is created when the order ships" });
    return invoiceView({ ...o, invoiceNumber: o.invoiceNumber, date: o.shipments[0]?.shippedAt ?? o.placedAt ?? o.createdAt, shippingAddress: o.shippingAddress as never }, await this.settings.business());
  }

  @Post("orders/track") @HttpCode(200)
  async track(@Body(new ZodPipe(trackDto)) b: z.infer<typeof trackDto>, @Req() req: Request) {
    await this.limiter.guard(`track:${req.ip}`, 10, 60_000, "Too many attempts, please wait a minute");
    return (await this.svc.track(b.orderNumber, b.phone)) ?? Promise.reject(new NotFoundException({ title: "We couldn't find an order with those details" }));
  }

  @Post("orders/:publicId/cancel") @HttpCode(200)
  async cancel(@Param("publicId") id: string) {
    const o = await this.db.order.findUnique({ where: { publicId: id.slice(0, 64) }, select: { id: true, status: true } });
    if (!o) throw new NotFoundException({ title: "Order not found" });
    if (!["PENDING_PAYMENT", "PLACED"].includes(o.status)) throw new HttpException({ title: "This order can no longer be cancelled online. Please contact support." }, 409);
    await this.svc.cancel(o.id, "Cancelled by customer", "customer");
    return this.svc.result(id);
  }
}
