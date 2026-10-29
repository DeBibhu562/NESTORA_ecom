import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { buildSearchText, parseCapacityMl, type Card, type FilterDef, type Item } from "./query";

type Snapshot = { at: number; items: Item[]; cats: { id: string; name: string; path: string; slug: string; parentId: string | null; description: string | null; imageUrl: string | null; position: number; seoTitle: string | null; seoDesc: string | null }[]; defs: (FilterDef & { categoryPath: string; filterable: boolean; showInSpecs: boolean; type: string; unit: string | null; position: number })[] };

const TTL_MS = Number(process.env.CATALOG_CACHE_MS ?? 15_000);
const MAX_STOCK_SHOWN = 10; // never expose exact inventory

@Injectable()
export class PublicCatalogService {
  // shortcut: per-instance TTL cache; admin edits show up within TTL. Add tag-based invalidation (Redis pub/sub) with the storefront revalidate webhook.
  private snap?: Snapshot;
  private loading?: Promise<Snapshot>;

  constructor(private readonly db: PrismaService) {}

  snapshot(): Promise<Snapshot> {
    if (this.snap && Date.now() - this.snap.at < TTL_MS) return Promise.resolve(this.snap);
    return (this.loading ??= this.load().then((s) => (this.snap = s)).finally(() => { this.loading = undefined; }));
  }

  private async load(): Promise<Snapshot> {
    const [cats, defs, products] = await Promise.all([
      this.db.category.findMany({ where: { isActive: true } }),
      this.db.attributeDefinition.findMany({ include: { category: { select: { path: true } } }, orderBy: { position: "asc" } }),
      this.db.product.findMany({
        where: { status: "ACTIVE", deletedAt: null, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
        include: {
          category: true,
          options: { orderBy: { position: "asc" }, include: { values: { orderBy: { position: "asc" } } } },
          variants: { where: { isActive: true }, orderBy: { position: "asc" }, include: { options: true, inventory: true } },
          media: { orderBy: { position: "asc" } },
        },
      }),
    ]);
    const activePaths = new Set(cats.map((c) => c.path));
    const chainActive = (path: string) => path.split("/").every((_, i, a) => activePaths.has(a.slice(0, i + 1).join("/")));

    const items: Item[] = [];
    for (const p of products) {
      if (!p.variants.length || !chainActive(p.category.path)) continue;
      const avail = (v: (typeof p.variants)[number]) => Math.max(0, v.inventory.reduce((n, i) => n + i.onHand - i.reserved, 0));
      const swatchOpt = p.options.find((o) => o.displayAs === "SWATCH");
      const capOpt = p.options.find((o) => o.name.toLowerCase() === "capacity");
      const usedIds = new Set(p.variants.flatMap((v) => v.options.map((o) => o.optionValueId)));

      const cheapest = p.variants.reduce((a, b) => (b.pricePaise < a.pricePaise ? b : a));
      const swatches = (swatchOpt?.values ?? []).filter((v) => usedIds.has(v.id)).map((v) => ({
        value: v.value, hex: v.hexColor, image: p.media.find((m) => m.optionValueId === v.id)?.url ?? null,
        inStock: p.variants.some((x) => avail(x) > 0 && x.options.some((o) => o.optionValueId === v.id)),
      }));
      const [m0, m1] = [p.media[0], p.media.find((m) => m.url !== p.media[0]?.url)];
      const card: Card = {
        id: p.id, slug: p.slug, title: p.title, tagline: p.tagline, badges: p.badges, ratingAvg: Number(p.ratingAvg), ratingCount: p.ratingCount,
        categoryPath: p.category.path, categoryName: p.category.name,
        minPricePaise: cheapest.pricePaise, maxPricePaise: Math.max(...p.variants.map((v) => v.pricePaise)), mrpPaise: cheapest.mrpPaise,
        discountPct: cheapest.mrpPaise > cheapest.pricePaise ? Math.round(((cheapest.mrpPaise - cheapest.pricePaise) / cheapest.mrpPaise) * 100) : 0,
        inStock: p.variants.some((v) => avail(v) > 0),
        image: m0 ? { url: m0.url, alt: m0.alt, width: m0.width, height: m0.height } : null, hoverImage: m1 ? { url: m1.url, alt: m1.alt } : null,
        swatches,
      };
      const attrs = p.attributes as Record<string, unknown>;
      items.push({
        card, createdAt: p.createdAt.getTime(), updatedAt: p.updatedAt.getTime(), attributes: attrs,
        capacitiesMl: (capOpt?.values ?? []).filter((v) => usedIds.has(v.id)).map((v) => parseCapacityMl(v.value)).filter((n): n is number => n !== null),
        colours: swatches.map((s) => s.value), prices: p.variants.map((v) => v.pricePaise),
        searchText: buildSearchText([p.title, p.tagline, p.category.name, ...p.badges, ...Object.values(attrs).filter((v) => typeof v === "string") as string[], ...p.options.flatMap((o) => o.values.map((v) => v.value))]),
      });
    }

    return {
      at: Date.now(), items, cats,
      defs: defs.map((d) => ({ key: d.key, label: d.label, enumValues: d.enumValues, categoryPath: d.category.path, filterable: d.isFilterable && d.type === "ENUM", showInSpecs: d.showInSpecs, type: d.type, unit: d.unit, position: d.position })),
    };
  }

  /** Filter definitions applicable to a category scope (its own + ancestors', or all when unscoped), de-duplicated by key. */
  filterDefs(s: Snapshot, categoryPath?: string): FilterDef[] {
    const chain = categoryPath ? categoryPath.split("/").map((_, i, a) => a.slice(0, i + 1).join("/")) : null;
    const out = new Map<string, FilterDef>();
    for (const d of s.defs) if (d.filterable && (!chain || chain.includes(d.categoryPath)) && !out.has(d.key)) out.set(d.key, { key: d.key, label: d.label, enumValues: d.enumValues });
    return [...out.values()];
  }

  async categoryTree() {
    const s = await this.snapshot();
    const count = (path: string) => s.items.filter((i) => i.card.categoryPath === path || i.card.categoryPath.startsWith(`${path}/`)).length;
    const node = (parentId: string | null): unknown[] =>
      s.cats.filter((c) => c.parentId === parentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.name, slug: c.slug, path: c.path, imageUrl: c.imageUrl, productCount: count(c.path), children: node(c.id) }));
    return node(null);
  }

  async categoryInfo(path: string) {
    const s = await this.snapshot();
    const cat = s.cats.find((c) => c.path === path);
    if (!cat) throw new NotFoundException("Category not found");
    const crumbs = path.split("/").map((_, i, a) => s.cats.find((c) => c.path === a.slice(0, i + 1).join("/"))!).map((c) => ({ name: c.name, path: c.path }));
    const children = s.cats.filter((c) => c.parentId === cat.id).sort((a, b) => a.position - b.position).map((c) => ({ name: c.name, path: c.path }));
    return { name: cat.name, path: cat.path, description: cat.description, imageUrl: cat.imageUrl, seoTitle: cat.seoTitle, seoDesc: cat.seoDesc, breadcrumbs: crumbs, children };
  }

  async product(slug: string) {
    const s = await this.snapshot();
    const item = s.items.find((i) => i.card.slug === slug);
    if (!item) throw new NotFoundException("Product not found");
    const p = await this.db.product.findUniqueOrThrow({
      where: { id: item.card.id },
      include: {
        options: { orderBy: { position: "asc" }, include: { values: { orderBy: { position: "asc" } } } },
        variants: { where: { isActive: true }, orderBy: { position: "asc" }, include: { options: true, inventory: true } },
        media: { orderBy: { position: "asc" } },
      },
    });
    const attrs = p.attributes as Record<string, unknown>;
    const chain = item.card.categoryPath.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"));
    const specs = s.defs.filter((d) => d.showInSpecs && chain.includes(d.categoryPath) && attrs[d.key] !== undefined)
      .sort((a, b) => chain.indexOf(a.categoryPath) - chain.indexOf(b.categoryPath) || a.position - b.position)
      .map((d) => ({ label: d.label, value: typeof attrs[d.key] === "boolean" ? (attrs[d.key] ? "Yes" : "No") : `${attrs[d.key]}${d.unit ? ` ${d.unit}` : ""}` }));
    if (p.warrantyMonths) specs.push({ label: "Warranty", value: `${p.warrantyMonths} months` });

    const used = new Set(p.variants.flatMap((v) => v.options.map((o) => o.optionValueId)));
    const pinned = await this.db.productRelation.findMany({ where: { fromId: p.id, type: "CROSS_SELL" }, orderBy: { position: "asc" }, select: { toId: true } });
    const pinnedCards = pinned.map((r) => s.items.find((i) => i.card.id === r.toId)?.card).filter((c): c is NonNullable<typeof c> => !!c);
    const related = [...pinnedCards, ...s.items.filter((i) => i.card.id !== p.id && !pinned.some((r) => r.toId === i.card.id))
      .sort((a, b) => Number(b.card.categoryPath === item.card.categoryPath) - Number(a.card.categoryPath === item.card.categoryPath) || Number(b.card.inStock) - Number(a.card.inStock) || b.createdAt - a.createdAt)
      .map((i) => i.card)].slice(0, 8);

    return {
      id: p.id, slug: p.slug, title: p.title, tagline: p.tagline, descriptionHtml: p.descriptionHtml, badges: p.badges,
      ratingAvg: Number(p.ratingAvg), ratingCount: p.ratingCount, seoTitle: p.seoTitle, seoDesc: p.seoDesc, updatedAt: p.updatedAt,
      personalization: p.personalizationEnabled ? { pricePaise: p.personalizationPricePaise } : null,
      breadcrumbs: await this.categoryInfo(item.card.categoryPath).then((c) => c.breadcrumbs),
      specs,
      options: p.options.map((o) => ({ id: o.id, name: o.name, displayAs: o.displayAs, values: o.values.filter((v) => used.has(v.id)).map((v) => ({ id: v.id, value: v.value, hexColor: v.hexColor })) })).filter((o) => o.values.length),
      variants: p.variants.map((v) => {
        const avail = Math.max(0, v.inventory.reduce((n, i) => n + i.onHand - i.reserved, 0));
        return { id: v.id, sku: v.sku, pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, optionValueIds: v.options.map((o) => o.optionValueId), inStock: avail > 0, maxQty: Math.min(avail, MAX_STOCK_SHOWN), weightGrams: v.weightGrams };
      }),
      media: p.media.map((m) => ({ id: m.id, url: m.url, alt: m.alt, width: m.width, height: m.height, optionValueId: m.optionValueId, variantId: m.variantId })),
      related,
    };
  }
}
