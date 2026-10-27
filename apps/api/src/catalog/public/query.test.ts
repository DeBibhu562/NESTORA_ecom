import { describe, expect, it } from "vitest";
import { buildSearchText, parseCapacityMl, queryItems, suggest, type Filters, type Item } from "./query";

let n = 0;
function item(o: { title: string; cat?: string; attrs?: Record<string, unknown>; caps?: number[]; colours?: string[]; prices: number[]; inStock?: boolean; badges?: string[]; rating?: number; created?: number }): Item {
  n++;
  return {
    createdAt: o.created ?? n, updatedAt: n, attributes: o.attrs ?? {}, capacitiesMl: o.caps ?? [], colours: o.colours ?? [], prices: o.prices,
    searchText: buildSearchText([o.title, o.cat ?? "bottles/vacuum", ...(o.colours ?? []), ...Object.values(o.attrs ?? {}).map(String)]),
    card: { id: `p${n}`, slug: `p${n}`, title: o.title, tagline: null, badges: o.badges ?? [], ratingAvg: o.rating ?? 0, ratingCount: 0, categoryPath: o.cat ?? "bottles/vacuum", categoryName: "x",
      minPricePaise: Math.min(...o.prices), maxPricePaise: Math.max(...o.prices), mrpPaise: 0, discountPct: 0, inStock: o.inStock ?? true, image: null, hoverImage: null, swatches: [] },
  };
}

const base: Filters = { attrs: {}, capacity: [], colour: [], inStock: false, sort: "featured", page: 1, limit: 24 };
const defs = [{ key: "material", label: "Material", enumValues: ["SS 304", "Copper", "Glass"] }];

const catalog = [
  item({ title: "Aero Bottle", attrs: { material: "SS 304" }, caps: [550, 715, 880], colours: ["Pink", "Black"], prices: [80200, 99800], badges: ["Bestseller"], rating: 4.8 }),
  item({ title: "Spark Flask", attrs: { material: "SS 304" }, caps: [620, 920], colours: ["Black", "Navy"], prices: [74900, 94900], inStock: false }),
  item({ title: "Royal Copper Bottle", cat: "bottles/copper", attrs: { material: "Copper" }, caps: [1000], colours: [], prices: [109900] }),
  item({ title: "Glass Infuser", cat: "bottles/glass", attrs: { material: "Glass" }, caps: [500, 750], colours: ["Grey"], prices: [39900, 47900] }),
];

describe("parseCapacityMl", () => {
  it("parses ml and litres, rejects others", () => {
    expect(parseCapacityMl("550 ml")).toBe(550);
    expect(parseCapacityMl("1 L")).toBe(1000);
    expect(parseCapacityMl("1.2 L")).toBe(1200);
    expect(parseCapacityMl("Pink")).toBeNull();
    expect(parseCapacityMl("Set of 3")).toBeNull();
  });
});

describe("filtering", () => {
  it("scopes by category subtree, not by string prefix", () => {
    expect(queryItems(catalog, { ...base, category: "bottles" }, defs).total).toBe(4);
    expect(queryItems(catalog, { ...base, category: "bottles/copper" }, defs).total).toBe(1);
    expect(queryItems(catalog, { ...base, category: "bottles/cop" }, defs).total).toBe(0);
  });

  it("ANDs across facets and ORs within one", () => {
    expect(queryItems(catalog, { ...base, attrs: { material: ["SS 304", "Copper"] } }, defs).total).toBe(3);
    expect(queryItems(catalog, { ...base, attrs: { material: ["SS 304"] }, colour: ["Black"] }, defs).total).toBe(2);
    expect(queryItems(catalog, { ...base, attrs: { material: ["SS 304"] }, colour: ["Navy"] }, defs).total).toBe(1);
  });

  it("matches capacity buckets on any variant (boundaries inclusive as documented)", () => {
    const r = (c: string) => queryItems(catalog, { ...base, capacity: [c] }, defs).items.map((x) => x.title).sort();
    expect(r("500-750")).toEqual(["Aero Bottle", "Glass Infuser", "Spark Flask"]); // 550/715, 500/750 and 620
    expect(r("750-1000")).toEqual(["Aero Bottle", "Royal Copper Bottle", "Spark Flask"]); // 880 / 1000 / 920; Glass's 750 is not > 750
    expect(r("gt1000")).toEqual([]);
  });

  it("filters by price on any variant and by stock", () => {
    expect(queryItems(catalog, { ...base, price: [40000, 81000] }, defs).items.map((x) => x.title).sort()).toEqual(["Aero Bottle", "Glass Infuser", "Spark Flask"]);
    expect(queryItems(catalog, { ...base, inStock: true }, defs).total).toBe(3);
  });

  it("searches all tokens, accent- and case-insensitively, across attributes", () => {
    expect(queryItems(catalog, { ...base, q: "COPPER bottle" }, defs).items.map((x) => x.title)).toEqual(["Royal Copper Bottle"]);
    expect(queryItems(catalog, { ...base, q: "ss 304 black" }, defs).total).toBe(2);
    expect(queryItems(catalog, { ...base, q: "zzz" }, defs).total).toBe(0);
  });
});

describe("facets", () => {
  it("counts disjunctively: a facet ignores its own selection but respects the others", () => {
    const r = queryItems(catalog, { ...base, attrs: { material: ["Copper"] } }, defs);
    const material = r.facets.find((f) => f.key === "material")!;
    expect(Object.fromEntries(material.values.map((v) => [v.value, v.count]))).toEqual({ "SS 304": 2, Copper: 1, Glass: 1 });
    expect(r.facets.find((f) => f.key === "colour")).toBeUndefined(); // colour counts DO respect material=Copper, and Copper has none → facet hidden
  });

  it("keeps a selected value visible even at zero count, and reports the price range", () => {
    const r = queryItems(catalog, { ...base, attrs: { material: ["SS 304"] }, colour: ["Grey"] }, defs);
    const grey = r.facets.find((f) => f.key === "colour")!.values.find((v) => v.value === "Grey")!;
    expect(grey.count).toBe(0);
    expect(queryItems(catalog, base, defs).price).toEqual({ min: 39900, max: 109900 });
  });
});

describe("sorting & paging", () => {
  it("featured puts bestsellers/in-stock first; price and newest sort as named", () => {
    expect(queryItems(catalog, base, defs).items[0]!.title).toBe("Aero Bottle");
    expect(queryItems(catalog, { ...base, sort: "price_asc" }, defs).items.map((x) => x.minPricePaise)).toEqual([39900, 74900, 80200, 109900]);
    expect(queryItems(catalog, { ...base, sort: "price_desc" }, defs).items[0]!.title).toBe("Royal Copper Bottle");
    expect(queryItems(catalog, { ...base, sort: "newest" }, defs).items[0]!.title).toBe("Glass Infuser");
  });

  it("paginates and clamps out-of-range pages", () => {
    const r = queryItems(catalog, { ...base, limit: 3, page: 2 }, defs);
    expect(r).toMatchObject({ page: 2, pages: 2, total: 4 });
    expect(r.items).toHaveLength(1);
    expect(queryItems(catalog, { ...base, limit: 3, page: 99 }, defs).page).toBe(2);
  });
});

describe("suggest", () => {
  it("ranks title-prefix matches first and caps results", () => {
    expect(suggest(catalog, "spa")[0]!.title).toBe("Spark Flask");
    expect(suggest(catalog, "bottle", 2).map((x) => x.title).sort()).toEqual(["Aero Bottle", "Royal Copper Bottle"]); // title hits outrank category-name hits
    expect(suggest(catalog, "   ")).toEqual([]);
    expect(suggest(catalog, "b", 1)).toHaveLength(1);
  });
});
