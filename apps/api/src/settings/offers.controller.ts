import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";

const paise = z.number().int().min(0).max(100_000_00);
const code = z.string().regex(/^[A-Z0-9]{3,20}$/, "Use 3–20 capital letters or digits");
const couponDto = z.object({
  type: z.enum(["PERCENT", "FLAT", "FREE_SHIPPING"]),
  valueBp: z.number().int().min(1).max(10000).nullable(), valuePaise: paise.nullable(), maxDiscountPaise: paise.nullable(),
  minSubtotalPaise: paise, usageLimit: z.number().int().min(1).max(10_000_000).nullable(),
  endsAt: z.string().datetime().nullable(), isActive: z.boolean(),
}).refine((d) => d.type !== "PERCENT" || d.valueBp, { message: "Enter a percentage", path: ["valueBp"] })
  .refine((d) => d.type !== "FLAT" || d.valuePaise, { message: "Enter an amount", path: ["valuePaise"] });
const milestoneDto = z.object({
  label: z.string().trim().min(1).max(60), thresholdPaise: paise.min(1), position: z.number().int().min(1).max(50),
  rewardType: z.enum(["FREE_SHIPPING", "COIN_DRAW", "DISCOUNT"]), valuePaise: paise.nullable(), isActive: z.boolean(),
}).refine((d) => d.rewardType !== "DISCOUNT" || d.valuePaise, { message: "Enter the discount amount", path: ["valuePaise"] });

@Controller("admin")
export class OffersController {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  @Get("coupons") @Perm("settings:read")
  coupons() { return this.db.coupon.findMany({ orderBy: { startsAt: "desc" } }); }

  /** Upsert by code. Coupons are never deleted (redemptions reference them); switch isActive off instead. */
  @Put("coupons/:code") @Perm("settings:write")
  async saveCoupon(@Param("code", new ZodPipe(code)) c: string, @Body(new ZodPipe(couponDto)) b: z.infer<typeof couponDto>, @Staff() s: StaffClaims) {
    const d = { ...b, endsAt: b.endsAt ? new Date(b.endsAt) : null, valueBp: b.type === "PERCENT" ? b.valueBp : null, valuePaise: b.type === "FLAT" ? b.valuePaise : null };
    const r = await this.db.coupon.upsert({ where: { code: c }, update: d, create: { code: c, startsAt: new Date(), ...d } });
    await this.audit.log(s.id, "coupon.save", "Coupon", c, b);
    return r;
  }

  @Get("milestones") @Perm("settings:read")
  milestones() { return this.db.cartMilestone.findMany({ orderBy: { position: "asc" } }); }

  @Post("milestones") @Perm("settings:write") @HttpCode(200)
  async createMilestone(@Body(new ZodPipe(milestoneDto)) b: z.infer<typeof milestoneDto>, @Staff() s: StaffClaims) {
    const r = await this.db.cartMilestone.create({ data: { ...b, valuePaise: b.rewardType === "DISCOUNT" ? b.valuePaise : null } });
    await this.audit.log(s.id, "milestone.create", "CartMilestone", r.id, b);
    return r;
  }

  @Put("milestones/:id") @Perm("settings:write")
  async saveMilestone(@Param("id") id: string, @Body(new ZodPipe(milestoneDto)) b: z.infer<typeof milestoneDto>, @Staff() s: StaffClaims) {
    const r = await this.db.cartMilestone.update({ where: { id }, data: { ...b, valuePaise: b.rewardType === "DISCOUNT" ? b.valuePaise : null } }).catch(() => null);
    if (!r) throw new NotFoundException();
    await this.audit.log(s.id, "milestone.save", "CartMilestone", id, b);
    return r;
  }

  @Delete("milestones/:id") @Perm("settings:write") @HttpCode(204)
  async deleteMilestone(@Param("id") id: string, @Staff() s: StaffClaims) {
    const r = await this.db.cartMilestone.deleteMany({ where: { id } });
    if (!r.count) throw new NotFoundException();
    await this.audit.log(s.id, "milestone.delete", "CartMilestone", id);
  }
}
