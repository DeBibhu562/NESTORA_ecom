import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { ProductsService } from "./products.service";

const paise = z.number().int().positive().max(100_000_00);
const option = z.object({
  name: z.string().min(1).max(40), displayAs: z.enum(["PILL", "SWATCH", "DROPDOWN"]).optional(),
  values: z.array(z.object({ value: z.string().min(1).max(40), hexColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).min(1).max(30)
    .refine((v) => new Set(v.map((x) => x.value.toLowerCase())).size === v.length, "Duplicate values"),
});
const optionsDto = z.array(option).max(3);
const createDto = z.object({
  title: z.string().min(2).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), categoryId: z.string().min(1),
  tagline: z.string().max(200).optional(), descriptionHtml: z.string().max(50_000).optional(),
  hsnCode: z.string().regex(/^\d{4,8}$/), gstRateBp: z.number().int().refine((n) => [0, 500, 1200, 1800, 2800].includes(n), "Not a GST slab"),
  attributes: z.record(z.unknown()).optional(), badges: z.array(z.string().max(30)).max(6).optional(),
  warrantyMonths: z.number().int().min(0).max(120).optional(), personalizationEnabled: z.boolean().optional(), personalizationPricePaise: paise.optional(),
  options: optionsDto.optional(),
});
const updateDto = createDto.omit({ options: true }).partial().extend({ seoTitle: z.string().max(70).optional(), seoDesc: z.string().max(170).optional() });
const statusDto = z.object({ status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) });
const genDto = z.object({ skuPrefix: z.string().regex(/^[A-Z0-9][A-Z0-9-]{1,20}$/), pricePaise: paise, mrpPaise: paise, weightGrams: z.number().int().positive().max(50_000) })
  .refine((d) => d.mrpPaise >= d.pricePaise, { message: "MRP must be at least the selling price", path: ["mrpPaise"] });
const patchDto = z.array(z.object({ id: z.string(), pricePaise: paise.optional(), mrpPaise: paise.optional(), weightGrams: z.number().int().positive().max(50_000).optional(), barcode: z.string().max(40).nullable().optional(), isActive: z.boolean().optional() })).min(1).max(200);
const listDto = z.object({ q: z.string().max(100).optional(), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(), categoryId: z.string().optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(25) });
const valueDto = z.object({ value: z.string().min(1).max(40), hexColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });

@Controller("admin/products")
export class ProductsController {
  constructor(private readonly svc: ProductsService, private readonly audit: AuditService) {}

  @Get() @Perm("product:read") list(@Query(new ZodPipe(listDto)) q: z.infer<typeof listDto>) { return this.svc.list(q); }
  @Get(":id") @Perm("product:read") get(@Param("id") id: string) { return this.svc.get(id); }

  @Post() @Perm("product:write")
  async create(@Body(new ZodPipe(createDto)) b: z.infer<typeof createDto>, @Staff() s: StaffClaims) {
    const p = await this.svc.create(b);
    await this.audit.log(s.id, "product.create", "Product", p.id, { title: b.title });
    return p;
  }

  @Patch(":id") @Perm("product:write")
  async update(@Param("id") id: string, @Body(new ZodPipe(updateDto)) b: z.infer<typeof updateDto>, @Staff() s: StaffClaims) {
    const p = await this.svc.update(id, b);
    await this.audit.log(s.id, "product.update", "Product", id, b);
    return p;
  }

  @Post(":id/status") @Perm("product:write") @HttpCode(200)
  async status(@Param("id") id: string, @Body(new ZodPipe(statusDto)) b: z.infer<typeof statusDto>, @Staff() s: StaffClaims) {
    const p = await this.svc.setStatus(id, b.status);
    await this.audit.log(s.id, "product.status", "Product", id, b);
    return p;
  }

  @Delete(":id") @Perm("product:write") @HttpCode(204)
  async remove(@Param("id") id: string, @Staff() s: StaffClaims) {
    await this.svc.archive(id);
    await this.audit.log(s.id, "product.delete", "Product", id);
  }

  @Put(":id/options") @Perm("product:write")
  async options(@Param("id") id: string, @Body(new ZodPipe(optionsDto)) b: z.infer<typeof optionsDto>, @Staff() s: StaffClaims) {
    const p = await this.svc.replaceOptions(id, b);
    await this.audit.log(s.id, "product.options", "Product", id, b);
    return p;
  }

  @Post(":id/options/:optionId/values") @Perm("product:write")
  async addValue(@Param("id") id: string, @Param("optionId") optionId: string, @Body(new ZodPipe(valueDto)) b: z.infer<typeof valueDto>, @Staff() s: StaffClaims) {
    const v = await this.svc.addOptionValue(id, optionId, b);
    await this.audit.log(s.id, "product.option_value", "Product", id, b);
    return v;
  }

  @Post(":id/variants/generate") @Perm("product:write") @HttpCode(200)
  async generate(@Param("id") id: string, @Body(new ZodPipe(genDto)) b: z.infer<typeof genDto>, @Staff() s: StaffClaims) {
    const r = await this.svc.generate(id, b);
    await this.audit.log(s.id, "variant.generate", "Product", id, { ...b, created: r.created });
    return r;
  }

  @Patch(":id/variants") @Perm("product:write")
  async patch(@Param("id") id: string, @Body(new ZodPipe(patchDto)) b: z.infer<typeof patchDto>, @Staff() s: StaffClaims) {
    const p = await this.svc.patchVariants(id, b);
    await this.audit.log(s.id, "variant.update", "Product", id, b);
    return p;
  }

  @Delete(":id/variants/:variantId") @Perm("product:write") @HttpCode(204)
  async delVariant(@Param("id") id: string, @Param("variantId") vid: string, @Staff() s: StaffClaims) {
    await this.svc.deleteVariant(id, vid);
    await this.audit.log(s.id, "variant.delete", "Variant", vid);
  }
}
