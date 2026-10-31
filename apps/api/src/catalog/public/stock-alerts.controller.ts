import { Body, Controller, HttpCode, HttpException, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { Public } from "../../auth/auth.types";
import { Limiter } from "../../common/limiter.service";
import { ZodPipe } from "../../common/zod.pipe";
import { env } from "../../env";
import { Notifier } from "../../notify/notifier.service";
import { PrismaService } from "../../prisma.service";

// Indian mobile (optionally +91/0 prefixed) → "+91XXXXXXXXXX"; otherwise a lowercase email.
export function normalizeContact(raw: string): string | null {
  const s = raw.trim();
  if (z.string().email().safeParse(s).success) return s.toLowerCase();
  const digits = s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

const dto = z.object({ variantId: z.string().min(1).max(40), contact: z.string().min(5).max(120) });

@Public()
@Controller("catalog/stock-alerts")
export class StockAlertsController {
  constructor(private readonly db: PrismaService, private readonly limiter: Limiter, private readonly notify: Notifier) {}

  /** Always answers {ok:true} for well-formed input so it can't be used to probe which variants exist. */
  @Post() @HttpCode(200)
  async subscribe(@Body(new ZodPipe(dto)) b: z.infer<typeof dto>, @Req() req: Request) {
    await this.limiter.guard(`stock:${req.ip}`, env.STOCK_ALERT_LIMIT_PER_HOUR, 3600_000, "Too many requests, try again later");
    const contact = normalizeContact(b.contact);
    if (!contact) throw new HttpException({ title: "Enter a valid email or 10-digit mobile number", errors: [{ path: "contact", message: "Enter a valid email or 10-digit mobile number" }] }, 400);
    const v = await this.db.variant.findFirst({ where: { id: b.variantId, isActive: true, product: { status: "ACTIVE", deletedAt: null } }, select: { id: true, sku: true, product: { select: { title: true } } } });
    if (v) {
      const known = await this.db.stockAlertSubscription.findUnique({ where: { variantId_contact: { variantId: v.id, contact } }, select: { variantId: true } });
      await this.db.stockAlertSubscription.upsert({ where: { variantId_contact: { variantId: v.id, contact } }, update: {}, create: { variantId: v.id, contact } });
      if (!known) void this.notify.admin(`Back-in-stock request: ${v.product.title}`, `A customer wants to be told when "${v.product.title}" (${v.sku}) is back in stock.\nContact: ${contact}`);
    }
    return { ok: true };
  }
}
