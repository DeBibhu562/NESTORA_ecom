import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { imageSize } from "image-size";
import { memoryStorage } from "multer";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { hasPerm } from "../auth/auth.guard";
import { Perm, Public, Staff, type StaffClaims } from "../auth/auth.types";
import { Limiter } from "../common/limiter.service";
import { ZodPipe } from "../common/zod.pipe";
import { env } from "../env";
import { REASONS } from "../orders/lifecycle";
import { ReturnsService } from "./returns.service";

const newReturn = z.object({
  reason: z.enum(REASONS), details: z.string().trim().max(500).optional(),
  items: z.array(z.object({ orderItemId: z.string().min(1), qty: z.number().int().min(1).max(20) })).min(1).max(20),
  photos: z.array(z.string().url().max(300)).max(4).default([]),
  refundMethod: z.enum(["UPI", "BANK"]).optional(), refundDetails: z.string().trim().min(5).max(300).optional(),
}).refine((d) => d.refundMethod !== "UPI" || /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(d.refundDetails ?? ""), { message: "Enter a valid UPI id like name@bank", path: ["refundDetails"] })
  .refine((d) => !d.refundMethod || !!d.refundDetails, { message: "Enter where to send the refund", path: ["refundDetails"] });
const approveDto = z.object({ awb: z.string().trim().max(60).optional(), note: z.string().trim().max(200).optional() });
const pickupDto = z.object({ awb: z.string().trim().min(3).max(60) });
const rejectDto = z.object({ reason: z.string().trim().min(3).max(200) });
const receiveDto = z.object({ items: z.array(z.object({ orderItemId: z.string(), restock: z.boolean() })).min(1) });
const refundDto = z.object({ amountPaise: z.number().int().positive().optional() });
const paidDto = z.object({ utr: z.string().trim().min(4).max(60) });
const listDto = z.object({ status: z.string().max(20).optional(), q: z.string().trim().max(30).optional() });

@Controller()
export class ReturnsController {
  constructor(private readonly svc: ReturnsService, private readonly limiter: Limiter, private readonly audit: AuditService) {}

  // ───────── customer: the unguessable order link is the credential, same as the order page ─────────
  @Public() @Get("orders/:publicId/returns")
  options(@Param("publicId") id: string) { return this.svc.options(id.slice(0, 64)); }

  @Public() @Post("orders/:publicId/returns/photos")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async photo(@Param("publicId") id: string, @UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    await this.limiter.guard(`retphoto:${req.ip}`, 20, 3_600_000, "Too many uploads, please try again later");
    await this.svc.options(id.slice(0, 64)); // 404 for unknown orders
    if (!file) throw new BadRequestException("file is required");
    let t: string | undefined;
    try { t = (imageSize(file.buffer) as { type?: string }).type; } catch { throw new BadRequestException("Not a valid image"); }
    if (!t || !["jpg", "png", "webp"].includes(t)) throw new BadRequestException("Only JPEG, PNG or WebP photos are allowed");
    const name = `ret-${randomBytes(12).toString("hex")}.${t}`;
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    await writeFile(join(env.UPLOAD_DIR, name), file.buffer);
    return { url: `${env.PUBLIC_API_URL}/uploads/${name}` };
  }

  @Public() @Post("orders/:publicId/returns")
  async create(@Param("publicId") id: string, @Body(new ZodPipe(newReturn)) b: z.infer<typeof newReturn>, @Req() req: Request) {
    await this.limiter.guard(`retreq:${req.ip}`, 10, 3_600_000, "Too many return requests, please try again later");
    const r = await this.svc.request(id.slice(0, 64), b);
    return { returnNumber: r.returnNumber, status: r.status, refundPaise: r.refundPaise };
  }

  // ───────── staff ─────────
  @Get("admin/returns") @Perm("return:read")
  list(@Query(new ZodPipe(listDto)) q: z.infer<typeof listDto>) { return this.svc.list(q); }

  @Get("admin/returns/:id") @Perm("return:read")
  one(@Param("id") id: string, @Staff() s: StaffClaims) { return this.svc.get(id, hasPerm(s.perms, "customer:reveal")); }

  @Post("admin/returns/:id/approve") @Perm("return:write") @HttpCode(200)
  async approve(@Param("id") id: string, @Body(new ZodPipe(approveDto)) b: z.infer<typeof approveDto>, @Staff() s: StaffClaims) { const r = await this.svc.approve(id, s.id, b); await this.audit.log(s.id, "return.approve", "Return", id, b); return r; }

  @Post("admin/returns/:id/pickup") @Perm("return:write") @HttpCode(200)
  pickup(@Param("id") id: string, @Body(new ZodPipe(pickupDto)) b: z.infer<typeof pickupDto>, @Staff() s: StaffClaims) { return this.svc.schedulePickup(id, s.id, b.awb); }

  @Post("admin/returns/:id/reject") @Perm("return:write") @HttpCode(200)
  async reject(@Param("id") id: string, @Body(new ZodPipe(rejectDto)) b: z.infer<typeof rejectDto>, @Staff() s: StaffClaims) { const r = await this.svc.reject(id, s.id, b.reason); await this.audit.log(s.id, "return.reject", "Return", id, b); return r; }

  @Post("admin/returns/:id/receive") @Perm("return:write") @HttpCode(200)
  async receive(@Param("id") id: string, @Body(new ZodPipe(receiveDto)) b: z.infer<typeof receiveDto>, @Staff() s: StaffClaims) { await this.svc.receive(id, s.id, b.items); return { ok: true }; }

  @Post("admin/returns/:id/refund") @Perm("return:write", "order:refund") @HttpCode(200)
  async refund(@Param("id") id: string, @Body(new ZodPipe(refundDto)) b: z.infer<typeof refundDto>, @Staff() s: StaffClaims, @Req() _r: Request) {
    const r = await this.svc.refund(id, s.id, b.amountPaise);
    await this.audit.log(s.id, "return.refund", "Return", id, { amountPaise: r.refundPaise });
    return { status: r.status, refundPaise: r.refundPaise };
  }

  @Get("admin/refunds/payouts") @Perm("order:refund")
  payouts(@Staff() s: StaffClaims) { return this.svc.payouts(hasPerm(s.perms, "customer:reveal")); }

  @Post("admin/refunds/:id/paid") @Perm("order:refund") @HttpCode(200)
  async paid(@Param("id") id: string, @Body(new ZodPipe(paidDto)) b: z.infer<typeof paidDto>, @Staff() s: StaffClaims) { await this.svc.markPaid(id, s.id, b.utr); await this.audit.log(s.id, "refund.paid", "Refund", id, { utr: b.utr }); return { ok: true }; }
}
