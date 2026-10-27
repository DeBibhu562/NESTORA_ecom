import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";
import { ProductsService } from "./products.service";
import { slugify } from "./slug";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const createDto = z.object({
  name: z.string().min(1).max(120), slug: z.string().regex(slugRe).optional(), parentId: z.string().nullable().optional(),
  description: z.string().max(2000).optional(), imageUrl: z.string().url().optional(), position: z.number().int().optional(),
  isActive: z.boolean().optional(), seoTitle: z.string().max(70).optional(), seoDesc: z.string().max(170).optional(),
});
const updateDto = createDto.partial();

const attrDto = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/), label: z.string().min(1).max(80), type: z.enum(["TEXT", "NUMBER", "ENUM", "BOOLEAN"]),
  unit: z.string().max(10).optional(), enumValues: z.array(z.string().min(1)).default([]), isFilterable: z.boolean().default(false),
  showInSpecs: z.boolean().default(true), isRequired: z.boolean().default(false), position: z.number().int().default(0),
}).refine((a) => a.type !== "ENUM" || a.enumValues.length > 0, { message: "ENUM needs values", path: ["enumValues"] });

@Controller("admin")
export class CategoriesController {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService, private readonly products: ProductsService) {}

  @Get("categories") @Perm("category:read")
  async tree() {
    const all = await this.db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
    const node = (parentId: string | null): unknown[] => all.filter((c) => c.parentId === parentId).map((c) => ({ ...c, productCount: c._count.products, children: node(c.id) }));
    return node(null);
  }

  @Post("categories") @Perm("category:write")
  async create(@Body(new ZodPipe(createDto)) b: z.infer<typeof createDto>, @Staff() s: StaffClaims) {
    const slug = b.slug ?? slugify(b.name);
    const parent = b.parentId ? await this.db.category.findUnique({ where: { id: b.parentId } }) : null;
    if (b.parentId && !parent) throw new NotFoundException("Parent not found");
    const { parentId, ...rest } = b;
    const c = await this.db.category.create({ data: { ...rest, slug, path: parent ? `${parent.path}/${slug}` : slug, parentId: parentId ?? null } });
    await this.audit.log(s.id, "category.create", "Category", c.id, b);
    return c;
  }

  @Patch("categories/:id") @Perm("category:write")
  async update(@Param("id") id: string, @Body(new ZodPipe(updateDto)) b: z.infer<typeof updateDto>, @Staff() s: StaffClaims) {
    const cur = await this.db.category.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException();
    if (b.parentId === id) throw new ConflictException("A category cannot be its own parent");
    const { parentId, ...rest } = b;
    const reparent = parentId !== undefined && parentId !== cur.parentId;
    const reslug = b.slug !== undefined && b.slug !== cur.slug;
    let path = cur.path;
    if (reparent || reslug) {
      const parent = (parentId !== undefined ? parentId : cur.parentId) ? await this.db.category.findUnique({ where: { id: (parentId ?? cur.parentId)! } }) : null;
      if (parent && (parent.path === cur.path || parent.path.startsWith(`${cur.path}/`))) throw new ConflictException("Cannot move a category under its own descendant");
      path = parent ? `${parent.path}/${b.slug ?? cur.slug}` : (b.slug ?? cur.slug);
    }
    const updated = await this.db.$transaction(async (tx) => {
      const u = await tx.category.update({ where: { id }, data: { ...rest, ...(parentId !== undefined ? { parentId } : {}), path } });
      if (path !== cur.path) // rewrite descendants' materialised paths
        await tx.$executeRaw`UPDATE "Category" SET "path" = ${path}::text || substr("path", ${cur.path.length + 1}::int) WHERE "path" LIKE ${cur.path + "/%"}::text`;
      return u;
    });
    await this.audit.log(s.id, "category.update", "Category", id, b);
    return updated;
  }

  @Delete("categories/:id") @Perm("category:write")
  async remove(@Param("id") id: string, @Staff() s: StaffClaims) {
    const [kids, prods] = await Promise.all([this.db.category.count({ where: { parentId: id } }), this.db.product.count({ where: { categoryId: id } })]);
    if (kids || prods) throw new ConflictException("Category still has sub-categories or products");
    await this.db.category.delete({ where: { id } });
    await this.audit.log(s.id, "category.delete", "Category", id);
    return { ok: true };
  }

  // ── attribute definitions (category-driven specs/filters) ──
  @Get("categories/:id/attributes") @Perm("attribute:read")
  attrs(@Param("id") id: string) {
    return this.db.attributeDefinition.findMany({ where: { categoryId: id }, orderBy: { position: "asc" } });
  }

  /** Own + inherited definitions: what a product in this category is validated against. */
  @Get("categories/:id/effective-attributes") @Perm("attribute:read")
  effective(@Param("id") id: string) {
    return this.products.definitionsFor(id);
  }

  @Post("categories/:id/attributes") @Perm("attribute:write")
  async addAttr(@Param("id") id: string, @Body(new ZodPipe(attrDto)) b: z.infer<typeof attrDto>, @Staff() s: StaffClaims) {
    const a = await this.db.attributeDefinition.create({ data: { ...b, categoryId: id } });
    await this.audit.log(s.id, "attribute.create", "AttributeDefinition", a.id, b);
    return a;
  }

  @Patch("attributes/:attrId") @Perm("attribute:write")
  async updAttr(@Param("attrId") attrId: string, @Body(new ZodPipe(attrDto.innerType().partial().omit({ key: true, type: true }))) b: Partial<z.infer<typeof attrDto>>, @Staff() s: StaffClaims) {
    const a = await this.db.attributeDefinition.update({ where: { id: attrId }, data: b });
    await this.audit.log(s.id, "attribute.update", "AttributeDefinition", attrId, b);
    return a;
  }

  @Delete("attributes/:attrId") @Perm("attribute:write")
  async delAttr(@Param("attrId") attrId: string, @Staff() s: StaffClaims) {
    await this.db.attributeDefinition.delete({ where: { id: attrId } });
    await this.audit.log(s.id, "attribute.delete", "AttributeDefinition", attrId);
    return { ok: true };
  }
}
