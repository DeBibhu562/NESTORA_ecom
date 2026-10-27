import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { Public } from "../../auth/auth.types";
import { ZodPipe } from "../../common/zod.pipe";
import { PublicCatalogService } from "./public.service";
import { queryItems, suggest, type Filters } from "./query";

const CACHE = "public, s-maxage=30, stale-while-revalidate=300";
const list = z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).flatMap((x) => x.split("|")).filter(Boolean).slice(0, 20));
const RESERVED = new Set(["category", "q", "sort", "page", "limit", "price", "in_stock", "capacity", "colour"]);

const listDto = z.object({
  category: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/).optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(["featured", "newest", "price_asc", "price_desc"]).default("featured"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  price: z.string().regex(/^\d{1,6}-\d{1,6}$/).optional(), // rupees, "200-3000"
  in_stock: z.enum(["1", "true"]).optional(),
  capacity: list, colour: list,
}).passthrough();

@Public()
@Controller("catalog")
export class PublicCatalogController {
  constructor(private readonly svc: PublicCatalogService) {}

  @Get("categories") @Header("Cache-Control", CACHE)
  categories() { return this.svc.categoryTree(); }

  @Get("products") @Header("Cache-Control", CACHE)
  async products(@Query(new ZodPipe(listDto)) q: z.infer<typeof listDto>) {
    const snap = await this.svc.snapshot();
    const category = q.category ? await this.svc.categoryInfo(q.category) : null;
    const defs = this.svc.filterDefs(snap, q.category);
    const attrs: Filters["attrs"] = {};
    for (const d of defs) { const v = list.parse((q as Record<string, unknown>)[d.key]); if (v.length && !RESERVED.has(d.key)) attrs[d.key] = v; }
    const [lo, hi] = q.price ? q.price.split("-").map(Number) as [number, number] : [0, 0];
    const filters: Filters = {
      category: q.category, q: q.q || undefined, attrs, capacity: q.capacity, colour: q.colour,
      price: q.price ? [Math.min(lo, hi) * 100, Math.max(lo, hi) * 100] : undefined, inStock: !!q.in_stock, sort: q.sort, page: q.page, limit: q.limit,
    };
    return { category, ...queryItems(snap.items, filters, defs) };
  }

  @Get("suggest") @Header("Cache-Control", CACHE)
  async suggest(@Query("q") q = "") {
    return { items: suggest((await this.svc.snapshot()).items, String(q).slice(0, 80)) };
  }

  @Get("sitemap") @Header("Cache-Control", CACHE)
  async sitemap() {
    const s = await this.svc.snapshot();
    return { products: s.items.map((i) => ({ slug: i.card.slug, updatedAt: new Date(i.updatedAt).toISOString() })), categories: s.cats.map((c) => c.path) };
  }

  @Get("products/:slug") @Header("Cache-Control", CACHE)
  product(@Param("slug") slug: string) { return this.svc.product(slug); }
}
