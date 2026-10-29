import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";
import { slugify } from "./slug";

const brandDto = z.object({ name: z.string().trim().min(2).max(60) });
const relatedDto = z.object({ ids: z.array(z.string().min(1)).max(8) });
const TYPE = "CROSS_SELL";

/** Brands and hand-picked "you may also like" products for the product editor. */
@Controller("admin")
export class CatalogExtrasController {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  @Get("brands") @Perm("product:read")
  brands() { return this.db.brand.findMany({ orderBy: { name: "asc" } }); }

  @Post("brands") @Perm("product:write")
  async addBrand(@Body(new ZodPipe(brandDto)) b: z.infer<typeof brandDto>, @Staff() s: StaffClaims) {
    const slug = slugify(b.name);
    const dupe = await this.db.brand.findFirst({ where: { OR: [{ name: { equals: b.name, mode: "insensitive" } }, { slug }] } });
    if (dupe) return dupe; // adding an existing brand just selects it
    const r = await this.db.brand.create({ data: { name: b.name, slug } });
    await this.audit.log(s.id, "brand.create", "Brand", r.id, b);
    return r;
  }

  @Get("products/:id/related") @Perm("product:read")
  async related(@Param("id") id: string) {
    const rows = await this.db.productRelation.findMany({ where: { fromId: id, type: TYPE, to: { deletedAt: null } }, orderBy: { position: "asc" }, select: { to: { select: { id: true, title: true, status: true, media: { take: 1, orderBy: { position: "asc" }, select: { url: true } } } } } });
    return rows.map((r) => ({ id: r.to.id, title: r.to.title, status: r.to.status, image: r.to.media[0]?.url ?? null }));
  }

  @Put("products/:id/related") @Perm("product:write") @HttpCode(200)
  async setRelated(@Param("id") id: string, @Body(new ZodPipe(relatedDto)) b: z.infer<typeof relatedDto>, @Staff() s: StaffClaims) {
    const ids = [...new Set(b.ids)];
    if (ids.includes(id)) throw new BadRequestException("A product cannot be related to itself");
    if ((await this.db.product.count({ where: { id: { in: ids }, deletedAt: null } })) !== ids.length) throw new BadRequestException("Unknown product");
    await this.db.$transaction([
      this.db.productRelation.deleteMany({ where: { fromId: id, type: TYPE } }),
      this.db.productRelation.createMany({ data: ids.map((toId, position) => ({ fromId: id, toId, type: TYPE, position })) }),
    ]);
    await this.audit.log(s.id, "product.related", "Product", id, { ids });
    return { ok: true };
  }
}
