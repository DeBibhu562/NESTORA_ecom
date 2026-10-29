import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";
import { SettingsService } from "./settings.service";

const paise = z.number().int().min(0).max(100_000_00);
const returnsDto = z.object({ windowDays: z.number().int().min(0).max(60), graceDays: z.number().int().min(0).max(14), pickupFeePaise: paise });
const businessDto = z.object({ legalName: z.string().trim().max(120), gstin: z.string().trim().toUpperCase().regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "Enter a valid 15-character GSTIN"), address: z.string().trim().max(300), state: z.string().trim().max(40), phone: z.string().trim().max(20), email: z.string().trim().max(100) });
const shippingDto = z.object({ flatPaise: paise, freeAbovePaise: paise });
const pin = z.string().regex(/^[1-9]\d{5}$/, "Pincode must be 6 digits");
const pinBody = z.object({ city: z.string().trim().min(1).max(60), state: z.string().trim().min(1).max(60), codAllowed: z.boolean(), etaDaysMin: z.number().int().min(0).max(30), etaDaysMax: z.number().int().min(0).max(30) })
  .refine((d) => d.etaDaysMax >= d.etaDaysMin, { message: "Max days must be at least min days", path: ["etaDaysMax"] });
const importDto = z.object({ rows: z.array(pinBody.and(z.object({ pincode: pin }))).min(1).max(1000) });
const listDto = z.object({ q: z.string().max(60).optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) });

@Controller("admin")
export class SettingsController {
  constructor(private readonly svc: SettingsService, private readonly db: PrismaService, private readonly audit: AuditService) {}

  @Get("settings/shipping") @Perm("settings:read") shipping() { return this.svc.shipping(); }

  @Get("settings/returns") @Perm("settings:read") returns() { return this.svc.returnRules(); }

  @Put("settings/returns") @Perm("settings:write")
  async saveReturns(@Body(new ZodPipe(returnsDto)) b: z.infer<typeof returnsDto>, @Staff() s: StaffClaims) {
    const r = await this.svc.saveReturnRules(b);
    await this.audit.log(s.id, "settings.returns", "Setting", "returns", b);
    return r;
  }

  @Get("settings/business") @Perm("settings:read") business() { return this.svc.business(); }

  @Put("settings/business") @Perm("settings:write")
  async saveBusiness(@Body(new ZodPipe(businessDto)) b: z.infer<typeof businessDto>, @Staff() s: StaffClaims) {
    const r = await this.svc.saveBusiness(b);
    await this.audit.log(s.id, "settings.business", "Setting", "business", { legalName: b.legalName });
    return r;
  }

  @Put("settings/shipping") @Perm("settings:write")
  async saveShipping(@Body(new ZodPipe(shippingDto)) b: z.infer<typeof shippingDto>, @Staff() s: StaffClaims) {
    const r = await this.svc.saveShipping(b);
    await this.audit.log(s.id, "settings.shipping", "Setting", "shipping", b);
    return r;
  }

  @Get("pincodes") @Perm("settings:read")
  async pincodes(@Query(new ZodPipe(listDto)) q: z.infer<typeof listDto>) {
    const where = q.q ? { OR: [{ pincode: { startsWith: q.q } }, { city: { contains: q.q, mode: "insensitive" as const } }] } : {};
    const [rows, total] = await Promise.all([
      this.db.serviceablePincode.findMany({ where, take: q.limit + 1, orderBy: { pincode: "asc" }, ...(q.cursor ? { cursor: { pincode: q.cursor }, skip: 1 } : {}) }),
      this.db.serviceablePincode.count({ where }),
    ]);
    const next = rows.length > q.limit ? rows.pop()!.pincode : null;
    return { items: rows, total, nextCursor: next };
  }

  @Put("pincodes/:pincode") @Perm("settings:write")
  async savePincode(@Param("pincode", new ZodPipe(pin)) pincode: string, @Body(new ZodPipe(pinBody)) b: z.infer<typeof pinBody>, @Staff() s: StaffClaims) {
    const r = await this.db.serviceablePincode.upsert({ where: { pincode }, update: b, create: { pincode, ...b } });
    await this.audit.log(s.id, "pincode.save", "ServiceablePincode", pincode, b);
    return r;
  }

  /** Bulk add/update, up to 1000 rows per request (the UI sends a pasted CSV in batches). */
  @Post("pincodes/import") @Perm("settings:write") @HttpCode(200)
  async importPincodes(@Body(new ZodPipe(importDto)) b: z.infer<typeof importDto>, @Staff() s: StaffClaims) {
    const rows = [...new Map(b.rows.map((r) => [r.pincode, r])).values()]; // last duplicate wins
    await this.db.$transaction(rows.map(({ pincode, ...d }) => this.db.serviceablePincode.upsert({ where: { pincode }, update: d, create: { pincode, ...d } })));
    await this.audit.log(s.id, "pincode.import", "ServiceablePincode", "bulk", { rows: rows.length });
    return { saved: rows.length };
  }

  @Delete("pincodes/:pincode") @Perm("settings:write") @HttpCode(204)
  async deletePincode(@Param("pincode", new ZodPipe(pin)) pincode: string, @Staff() s: StaffClaims) {
    const r = await this.db.serviceablePincode.deleteMany({ where: { pincode } });
    if (!r.count) throw new NotFoundException();
    await this.audit.log(s.id, "pincode.delete", "ServiceablePincode", pincode);
  }
}
