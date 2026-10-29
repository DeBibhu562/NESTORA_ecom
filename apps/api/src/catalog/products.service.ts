import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, ProductStatus } from "@prisma/client";
import sanitizeHtml from "sanitize-html";
import { PrismaService } from "../prisma.service";
import { validateAttributes } from "./attributes";
import { slugify } from "./slug";
import { comboKey, generateVariants, type Defaults } from "./variants";

export const clean = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "b", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "a", "table", "thead", "tbody", "tr", "th", "td", "blockquote"],
    allowedAttributes: { a: ["href", "title", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  });

export type OptionIn = { name: string; displayAs?: string; values: { value: string; hexColor?: string }[] };

@Injectable()
export class ProductsService {
  constructor(private readonly db: PrismaService) {}

  /** Attribute definitions of the category and all its ancestors (a sub-category inherits "Bottles" attributes). */
  async definitionsFor(categoryId: string) {
    const cat = await this.db.category.findUnique({ where: { id: categoryId } });
    if (!cat) throw new BadRequestException("Category not found");
    const paths = cat.path.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"));
    return this.db.attributeDefinition.findMany({ where: { category: { path: { in: paths } } }, orderBy: { position: "asc" } });
  }

  private async assertAttrs(categoryId: string, attrs: Record<string, unknown>, requireAll: boolean) {
    const problems = validateAttributes(attrs, await this.definitionsFor(categoryId), requireAll);
    if (problems.length) throw new BadRequestException({ title: "Invalid attributes", errors: problems.map((message) => ({ path: "attributes", message })) });
  }

  private async uniqueSlug(base: string) {
    for (let n = 1; ; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      if (!(await this.db.product.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    }
  }

  async create(b: { title: string; slug?: string; categoryId: string; tagline?: string; descriptionHtml?: string; hsnCode: string; gstRateBp: number; attributes?: Record<string, unknown>; badges?: string[]; warrantyMonths?: number; personalizationEnabled?: boolean; personalizationPricePaise?: number; options?: OptionIn[] }) {
    await this.assertAttrs(b.categoryId, b.attributes ?? {}, false);
    const names = (b.options ?? []).map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) throw new BadRequestException("Duplicate option names");
    const { options, descriptionHtml, slug, attributes, ...rest } = b;
    return this.db.product.create({
      data: {
        ...rest,
        slug: await this.uniqueSlug(slug ?? slugify(b.title)),
        descriptionHtml: clean(descriptionHtml ?? ""),
        attributes: (attributes ?? {}) as Prisma.InputJsonValue,
        options: { create: (options ?? []).map((o, i) => ({ name: o.name, displayAs: o.displayAs ?? "PILL", position: i, values: { create: o.values.map((v, j) => ({ value: v.value, hexColor: v.hexColor, position: j })) } })) },
      },
      include: this.full,
    });
  }

  readonly full = {
    category: true,
    options: { orderBy: { position: "asc" as const }, include: { values: { orderBy: { position: "asc" as const } } } },
    variants: { orderBy: { position: "asc" as const }, include: { options: true, inventory: true } },
    media: { orderBy: { position: "asc" as const } },
  };

  async get(id: string) {
    const p = await this.db.product.findFirst({ where: { id, deletedAt: null }, include: this.full });
    if (!p) throw new NotFoundException();
    return p;
  }

  async list(q: { q?: string; status?: ProductStatus | "DELETED"; categoryId?: string; cursor?: string; limit: number }) {
    const deleted = q.status === "DELETED";
    const where: Prisma.ProductWhereInput = { deletedAt: deleted ? { not: null } : null, status: q.status === "DELETED" ? undefined : q.status, categoryId: q.categoryId, title: q.q ? { contains: q.q, mode: "insensitive" } : undefined };
    const rows = await this.db.product.findMany({
      where, take: q.limit + 1, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, slug: true, title: true, status: true, updatedAt: true, category: { select: { name: true } }, media: { take: 1, orderBy: { position: "asc" }, select: { url: true, alt: true } }, variants: { select: { pricePaise: true, isActive: true, inventory: { select: { onHand: true, reserved: true } } } } },
    });
    const next = rows.length > q.limit ? rows.pop()!.id : null;
    return {
      total: await this.db.product.count({ where }),
      items: rows.map(({ variants, media, category, ...p }) => ({
        ...p, category: category.name, image: media[0] ?? null, variantCount: variants.length,
        minPricePaise: variants.length ? Math.min(...variants.map((v) => v.pricePaise)) : null,
        available: variants.reduce((n, v) => n + v.inventory.reduce((m, i) => m + i.onHand - i.reserved, 0), 0),
      })),
      nextCursor: next,
    };
  }

  async update(id: string, b: Record<string, unknown> & { categoryId?: string; attributes?: Record<string, unknown>; descriptionHtml?: string }) {
    const cur = await this.get(id);
    if (typeof b.slug === "string" && b.slug !== cur.slug && (await this.db.product.findUnique({ where: { slug: b.slug }, select: { id: true } }))) throw new BadRequestException("That URL slug is already used by another product");
    await this.assertAttrs(b.categoryId ?? cur.categoryId, b.attributes ?? (cur.attributes as Record<string, unknown>), false);
    const { descriptionHtml, attributes, ...rest } = b;
    return this.db.product.update({
      where: { id },
      data: { ...(rest as object), ...(descriptionHtml !== undefined ? { descriptionHtml: clean(descriptionHtml) } : {}), ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}) },
      include: this.full,
    });
  }

  /** Publishing gate: only a complete, sellable product can go ACTIVE. */
  async setStatus(id: string, status: ProductStatus) {
    const p = await this.get(id);
    if (status === "ACTIVE") {
      const errors: string[] = [];
      if (!p.variants.some((v) => v.isActive)) errors.push("At least one active variant is required");
      if (p.media.length === 0) errors.push("At least one image is required");
      if (!p.descriptionHtml.trim()) errors.push("Description is required");
      errors.push(...validateAttributes(p.attributes as Record<string, unknown>, await this.definitionsFor(p.categoryId), true));
      if (errors.length) throw new BadRequestException({ title: "Product is not ready to publish", errors: errors.map((message) => ({ path: "", message })) });
    }
    return this.db.product.update({ where: { id }, data: { status }, include: this.full });
  }

  /** Copies a product as a DRAFT with options and variants (new SKUs, no stock, no media) so it must be re-checked before publishing. */
  async duplicate(id: string) {
    const src = await this.get(id);
    const copy = await this.create({
      title: `${src.title} (Copy)`.slice(0, 160), categoryId: src.categoryId, tagline: src.tagline ?? undefined, descriptionHtml: src.descriptionHtml,
      hsnCode: src.hsnCode, gstRateBp: src.gstRateBp, attributes: src.attributes as Record<string, unknown>, badges: src.badges,
      warrantyMonths: src.warrantyMonths ?? undefined, personalizationEnabled: src.personalizationEnabled, personalizationPricePaise: src.personalizationPricePaise ?? undefined,
      options: src.options.map((o) => ({ name: o.name, displayAs: o.displayAs, values: o.values.map((v) => ({ value: v.value, hexColor: v.hexColor ?? undefined })) })),
    });
    const newVal = new Map(copy.options.flatMap((o) => o.values.map((v) => [`${o.name}\u0000${v.value}`, v.id] as const)));
    const oldVal = new Map(src.options.flatMap((o) => o.values.map((v) => [v.id, `${o.name}\u0000${v.value}`] as const)));
    const tag = Date.now().toString(36).toUpperCase().slice(-4);
    await this.db.$transaction(src.variants.map((v, i) => this.db.variant.create({
      data: {
        productId: copy.id, sku: `${v.sku}-C${tag}${i}`.slice(0, 40), pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, weightGrams: v.weightGrams, position: i, isActive: v.isActive,
        options: { create: v.options.map((o) => ({ optionValueId: newVal.get(oldVal.get(o.optionValueId)!)! })) },
      },
    })));
    return this.get(copy.id);
  }

  async archive(id: string) {
    await this.get(id);
    await this.db.product.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  }

  /** Undo a soft delete. It returns as ARCHIVED so nothing goes live without an explicit publish. */
  async restore(id: string) {
    const p = await this.db.product.findFirst({ where: { id, deletedAt: { not: null } }, select: { id: true } });
    if (!p) throw new NotFoundException();
    await this.db.product.update({ where: { id }, data: { deletedAt: null, status: "ARCHIVED" } });
    return this.get(id);
  }

  // ── options ──
  async replaceOptions(id: string, options: OptionIn[]) {
    const p = await this.get(id);
    if (p.variants.length) throw new ConflictException("Options are locked once variants exist; add values instead");
    const names = options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) throw new BadRequestException("Duplicate option names");
    await this.db.$transaction([
      this.db.productOption.deleteMany({ where: { productId: id } }),
      ...options.map((o, i) => this.db.productOption.create({ data: { productId: id, name: o.name, displayAs: o.displayAs ?? "PILL", position: i, values: { create: o.values.map((v, j) => ({ value: v.value, hexColor: v.hexColor, position: j })) } } })),
    ]);
    return this.get(id);
  }

  async addOptionValue(productId: string, optionId: string, v: { value: string; hexColor?: string }) {
    const o = await this.db.productOption.findFirst({ where: { id: optionId, productId }, include: { values: true } });
    if (!o) throw new NotFoundException();
    return this.db.optionValue.create({ data: { optionId, value: v.value, hexColor: v.hexColor, position: o.values.length } });
  }

  // ── variants ──
  async generate(id: string, d: Defaults & { skuPrefix: string }) {
    const p = await this.get(id);
    const existing = new Set(p.variants.map((v) => comboKey(v.options.map((o) => o.optionValueId))));
    const taken = new Set((await this.db.variant.findMany({ where: { sku: { startsWith: d.skuPrefix } }, select: { sku: true } })).map((v) => v.sku));
    const gen = generateVariants(p.options, existing, taken, d.skuPrefix, d);
    if (gen.length === 0) return { created: 0, product: p };
    const start = p.variants.length;
    await this.db.$transaction(gen.map((g, i) => this.db.variant.create({
      data: { productId: id, sku: g.sku, pricePaise: g.pricePaise, mrpPaise: g.mrpPaise, weightGrams: g.weightGrams, position: start + i, options: { create: g.optionValueIds.map((optionValueId) => ({ optionValueId })) } },
    })));
    return { created: gen.length, product: await this.get(id) };
  }

  async patchVariants(id: string, patches: { id: string; pricePaise?: number; mrpPaise?: number; weightGrams?: number; barcode?: string | null; isActive?: boolean }[]) {
    const own = await this.db.variant.findMany({ where: { productId: id, id: { in: patches.map((x) => x.id) } } });
    if (own.length !== new Set(patches.map((x) => x.id)).size) throw new NotFoundException("Variant not found in this product");
    for (const pt of patches) {
      const cur = own.find((v) => v.id === pt.id)!;
      if ((pt.mrpPaise ?? cur.mrpPaise) < (pt.pricePaise ?? cur.pricePaise)) throw new BadRequestException(`MRP must be at least the selling price (${cur.sku})`);
    }
    await this.db.$transaction(patches.map(({ id: vid, ...data }) => this.db.variant.update({ where: { id: vid }, data })));
    return this.get(id);
  }

  async deleteVariant(productId: string, variantId: string) {
    const ordered = await this.db.orderItem.count({ where: { variantId } });
    if (ordered) throw new ConflictException("Variant has orders; deactivate it instead");
    const v = await this.db.variant.findFirst({ where: { id: variantId, productId } });
    if (!v) throw new NotFoundException();
    await this.db.variant.delete({ where: { id: variantId } });
  }
}
