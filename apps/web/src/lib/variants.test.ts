import { expect, it } from "vitest";
import type { MediaItem, Option, Variant } from "./api";
import { discountPct, galleryFor, initialVariant, resolveVariant, selectValue, selectionOf, valueInStock } from "./variants";

const opt = (id: string, name: string, vals: string[]): Option => ({ id, name, displayAs: "PILL", values: vals.map((v) => ({ id: `${id}:${v}`, value: v, hexColor: null })) });
const options = [opt("cap", "Capacity", ["550", "880"]), opt("col", "Colour", ["Pink", "Ivory", "Black"])];
const v = (sku: string, cap: string, col: string, inStock = true, price = 80200): Variant => ({ id: sku, sku, pricePaise: price, mrpPaise: 98000, optionValueIds: [`cap:${cap}`, `col:${col}`], inStock, maxQty: inStock ? 5 : 0, weightGrams: 300 });
// 880/Ivory sold out; 880/Black does not exist
const variants = [v("A", "550", "Pink"), v("B", "550", "Ivory"), v("C", "550", "Black"), v("D", "880", "Pink"), v("E", "880", "Ivory", false)];

it("initial variant: requested sku, else first in stock", () => {
  expect(initialVariant(variants, "E")!.sku).toBe("E");
  expect(initialVariant(variants, "nope")!.sku).toBe("A");
  expect(initialVariant(variants.map((x) => ({ ...x, inStock: false })))!.sku).toBe("A");
  expect(initialVariant([], "x")).toBeUndefined();
});

it("resolves exact combinations only", () => {
  expect(resolveVariant(variants, options, { cap: "cap:550", col: "col:Ivory" })!.sku).toBe("B");
  expect(resolveVariant(variants, options, { cap: "cap:880", col: "col:Black" })).toBeUndefined();
  expect(resolveVariant(variants, options, { cap: "cap:550" })).toBeUndefined();
});

it("selecting a value keeps other choices when possible", () => {
  const start = selectionOf(options, variants[1]!); // 550/Ivory
  expect(selectValue(variants, options, start, "cap", "cap:880")).toEqual({ cap: "cap:880", col: "col:Ivory" }); // exists (sold out) → keep colour
});

it("selecting a value with no matching combination falls back to the closest in-stock variant", () => {
  const start = selectionOf(options, variants[2]!); // 550/Black
  const next = selectValue(variants, options, start, "cap", "cap:880"); // 880/Black doesn't exist
  expect(next.cap).toBe("cap:880");
  expect(resolveVariant(variants, options, next)!.sku).toBe("D"); // in-stock 880 beats sold-out 880/Ivory
});

it("reports per-value stock given the current other selections", () => {
  const sel = { cap: "cap:880", col: "col:Pink" };
  expect(valueInStock(variants, options, sel, "col", "col:Ivory")).toBe(false); // 880/Ivory sold out
  expect(valueInStock(variants, options, sel, "col", "col:Pink")).toBe(true);
  expect(valueInStock(variants, options, sel, "col", "col:Black")).toBe(true); // no 880/Black → any Black in stock
});

const media = (id: string, o: Partial<MediaItem> = {}): MediaItem => ({ id, url: id, alt: id, width: 1, height: 1, optionValueId: null, variantId: null, ...o });

it("gallery prefers colour/variant images, then generic, then everything", () => {
  const m = [media("pink", { optionValueId: "col:Pink" }), media("black", { optionValueId: "col:Black" }), media("generic")];
  expect(galleryFor(m, variants[0], { cap: "cap:550", col: "col:Pink" }).map((x) => x.id)).toEqual(["pink", "generic"]);
  expect(galleryFor(m, variants[1], { cap: "cap:550", col: "col:Ivory" }).map((x) => x.id)).toEqual(["generic"]);
  expect(galleryFor([m[0]!, m[1]!], variants[1], { col: "col:Ivory" }).map((x) => x.id)).toEqual(["pink", "black"]); // nothing matches → show all
  expect(galleryFor([media("p", { variantId: "A" })], variants[0], {}).map((x) => x.id)).toEqual(["p"]);
});

it("discount percent", () => {
  expect(discountPct({ pricePaise: 80200, mrpPaise: 98000 })).toBe(18);
  expect(discountPct({ pricePaise: 100, mrpPaise: 100 })).toBe(0);
});
