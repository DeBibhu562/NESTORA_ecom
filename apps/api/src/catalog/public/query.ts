// Pure listing logic for the public catalog: filtering, disjunctive facets, sorting, search.
// shortcut: runs in memory over the cached active catalog; fine to ~2k products. Move to SQL/Meilisearch (plan Phase C) beyond that.

export type SortKey = "featured" | "newest" | "price_asc" | "price_desc";

export type Card = {
  id: string; slug: string; title: string; tagline: string | null; badges: string[]; ratingAvg: number; ratingCount: number;
  categoryPath: string; categoryName: string;
  minPricePaise: number; maxPricePaise: number; mrpPaise: number; discountPct: number; inStock: boolean;
  image: { url: string; alt: string; width: number; height: number } | null; hoverImage: { url: string; alt: string } | null;
  swatches: { value: string; hex: string | null; image: string | null; inStock: boolean }[];
};

export type Item = {
  card: Card; createdAt: number; updatedAt: number; attributes: Record<string, unknown>; capacitiesMl: number[]; colours: string[]; prices: number[]; searchText: string;
};

export type Filters = {
  category?: string; q?: string; attrs: Record<string, string[]>; capacity: string[]; colour: string[];
  price?: [number, number]; inStock: boolean; sort: SortKey; page: number; limit: number;
};

export type FacetValue = { value: string; label: string; count: number };
export type Facet = { key: string; label: string; values: FacetValue[] };
export type FilterDef = { key: string; label: string; enumValues: string[] };

export const CAPACITY_BUCKETS = [
  { id: "lt500", label: "Under 500 ml", test: (ml: number) => ml < 500 },
  { id: "500-750", label: "500 – 750 ml", test: (ml: number) => ml >= 500 && ml <= 750 },
  { id: "750-1000", label: "750 ml – 1 L", test: (ml: number) => ml > 750 && ml <= 1000 },
  { id: "gt1000", label: "Over 1 L", test: (ml: number) => ml > 1000 },
] as const;

/** "550 ml" → 550, "1.2 L" → 1200, anything else → null. */
export function parseCapacityMl(v: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(ml|l|litre|liter|litres|liters)\s*$/i.exec(v);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return Math.round(/^m/i.test(m[2]!) ? n : n * 1000);
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
export const buildSearchText = (parts: (string | null | undefined)[]) => norm(parts.filter(Boolean).join(" "));

const tokens = (q: string) => norm(q).split(/[^a-z0-9]+/).filter(Boolean);

type Dim = "category" | "q" | "attr" | "capacity" | "colour" | "price" | "stock";

function matches(it: Item, f: Filters, skip?: { dim: Dim; key?: string }): boolean {
  const skipped = (d: Dim, k?: string) => skip?.dim === d && (k === undefined || skip.key === k);
  if (f.category && !skipped("category") && !(it.card.categoryPath === f.category || it.card.categoryPath.startsWith(`${f.category}/`))) return false;
  if (f.q && !skipped("q") && !tokens(f.q).every((t) => it.searchText.includes(t))) return false;
  for (const [k, vals] of Object.entries(f.attrs)) {
    if (!vals.length || skipped("attr", k)) continue;
    if (!vals.includes(String(it.attributes[k]))) return false;
  }
  if (f.capacity.length && !skipped("capacity") && !it.capacitiesMl.some((ml) => CAPACITY_BUCKETS.some((b) => f.capacity.includes(b.id) && b.test(ml)))) return false;
  if (f.colour.length && !skipped("colour") && !it.colours.some((c) => f.colour.includes(c))) return false;
  if (f.price && !skipped("price") && !it.prices.some((p) => p >= f.price![0] && p <= f.price![1])) return false;
  if (f.inStock && !skipped("stock") && !it.card.inStock) return false;
  return true;
}

function relevance(it: Item, q: string) {
  const t = norm(it.card.title), n = norm(q).trim();
  return t.startsWith(n) ? 3 : t.split(/\s+/).some((w) => w.startsWith(n)) ? 2 : t.includes(n) ? 1 : 0;
}

const featured = (c: Card) => (c.badges.includes("Bestseller") ? 1000 : 0) + c.ratingAvg * 10 + (c.inStock ? 5 : 0);

function sorter(f: Filters) {
  const byTitle = (a: Item, b: Item) => a.card.title.localeCompare(b.card.title);
  switch (f.sort) {
    case "price_asc": return (a: Item, b: Item) => a.card.minPricePaise - b.card.minPricePaise || byTitle(a, b);
    case "price_desc": return (a: Item, b: Item) => b.card.minPricePaise - a.card.minPricePaise || byTitle(a, b);
    case "newest": return (a: Item, b: Item) => b.createdAt - a.createdAt || byTitle(a, b);
    default: return (a: Item, b: Item) => (f.q ? relevance(b, f.q) - relevance(a, f.q) : 0) || featured(b.card) - featured(a.card) || b.createdAt - a.createdAt || byTitle(a, b);
  }
}

export function queryItems(all: Item[], f: Filters, defs: FilterDef[]) {
  const hits = all.filter((it) => matches(it, f)).sort(sorter(f));
  const total = hits.length;
  const pages = Math.max(1, Math.ceil(total / f.limit));
  const page = Math.min(Math.max(1, f.page), pages);
  const items = hits.slice((page - 1) * f.limit, page * f.limit).map((i) => i.card);

  // Disjunctive faceting: a facet's counts ignore its own selection, so users can widen a selection.
  const facets: Facet[] = [];
  const count = (dim: Dim, key: string | undefined, values: Map<string, string>, pick: (it: Item) => string[]) => {
    const pool = all.filter((it) => matches(it, f, { dim, key }));
    const counts = new Map<string, number>();
    for (const it of pool) for (const v of new Set(pick(it))) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...values].map(([value, label]) => ({ value, label, count: counts.get(value) ?? 0 })).filter((v) => v.count > 0 || (key ? f.attrs[key] ?? [] : dim === "capacity" ? f.capacity : f.colour).includes(v.value));
  };

  const capPool = all.filter((it) => matches(it, f, { dim: "capacity" }));
  const capValues = count("capacity", undefined, new Map(CAPACITY_BUCKETS.map((b) => [b.id, b.label])), (it) => CAPACITY_BUCKETS.filter((b) => it.capacitiesMl.some(b.test)).map((b) => b.id));
  if (capPool.some((it) => it.capacitiesMl.length)) facets.push({ key: "capacity", label: "Capacity", values: capValues });

  for (const d of defs) {
    const present = new Map<string, string>();
    for (const it of all) { const v = it.attributes[d.key]; if (typeof v === "string") present.set(v, v); }
    const ordered = new Map(d.enumValues.filter((v) => present.has(v)).map((v) => [v, v] as [string, string]));
    const values = count("attr", d.key, ordered, (it) => [String(it.attributes[d.key])]);
    if (values.length) facets.push({ key: d.key, label: d.label, values });
  }

  const colours = new Map<string, string>();
  for (const it of all) for (const c of it.colours) colours.set(c, c);
  const colourValues = count("colour", undefined, new Map([...colours].sort()), (it) => it.colours);
  if (colourValues.length) facets.push({ key: "colour", label: "Colour", values: colourValues });

  const pricePool = all.filter((it) => matches(it, f, { dim: "price" })).flatMap((it) => it.prices);
  return {
    items, total, page, pages, facets,
    price: pricePool.length ? { min: Math.min(...pricePool), max: Math.max(...pricePool) } : null,
    inStockCount: all.filter((it) => matches(it, f, { dim: "stock" }) && it.card.inStock).length,
  };
}

export function suggest(all: Item[], q: string, limit = 6) {
  const t = tokens(q);
  if (!t.length) return [];
  return all.filter((it) => t.every((x) => it.searchText.includes(x))).sort((a, b) => relevance(b, q) - relevance(a, q) || featured(b.card) - featured(a.card)).slice(0, limit).map((i) => i.card);
}
