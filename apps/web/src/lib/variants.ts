import type { MediaItem, Option, Variant } from "./api";

/** Selected option value id per option id. */
export type Selection = Record<string, string>;

const valueIds = (v: Variant) => new Set(v.optionValueIds);

export function selectionOf(options: Option[], v: Variant): Selection {
  const ids = valueIds(v);
  return Object.fromEntries(options.flatMap((o) => { const hit = o.values.find((x) => ids.has(x.id)); return hit ? [[o.id, hit.id]] : []; }));
}

/** The variant that has exactly the selected value for every option; undefined if that combination doesn't exist. */
export function resolveVariant(variants: Variant[], options: Option[], sel: Selection): Variant | undefined {
  return variants.find((v) => options.every((o) => sel[o.id] && valueIds(v).has(sel[o.id]!)));
}

/** Default: the requested sku, else the first in-stock variant, else the first variant. */
export function initialVariant(variants: Variant[], sku?: string | null): Variant | undefined {
  return variants.find((v) => v.sku === sku) ?? variants.find((v) => v.inStock) ?? variants[0];
}

/**
 * Pick a value for one option. If that exact combination doesn't exist, keep as many of the
 * other current choices as possible (preferring in-stock variants) instead of leaving a dead state.
 */
export function selectValue(variants: Variant[], options: Option[], sel: Selection, optionId: string, valueId: string): Selection {
  const candidates = variants.filter((v) => valueIds(v).has(valueId));
  if (!candidates.length) return sel;
  const score = (v: Variant) => options.filter((o) => o.id !== optionId && sel[o.id] && valueIds(v).has(sel[o.id]!)).length * 2 + (v.inStock ? 1 : 0);
  const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
  return selectionOf(options, best);
}

/** Whether choosing `valueId` (keeping the other current choices) leads to an in-stock variant. */
export function valueInStock(variants: Variant[], options: Option[], sel: Selection, optionId: string, valueId: string): boolean {
  const next = { ...sel, [optionId]: valueId };
  const exact = resolveVariant(variants, options, next);
  if (exact) return exact.inStock;
  return variants.some((v) => v.inStock && valueIds(v).has(valueId)); // combination doesn't exist: fall back to any variant with this value
}

/** Images for the current choice: pinned to the variant, or to a selected option value, or generic. Falls back to everything. */
export function galleryFor(media: MediaItem[], variant: Variant | undefined, sel: Selection): MediaItem[] {
  const chosen = new Set(Object.values(sel));
  const specific = media.filter((m) => (m.variantId && m.variantId === variant?.id) || (m.optionValueId && chosen.has(m.optionValueId)));
  const generic = media.filter((m) => !m.variantId && !m.optionValueId);
  const out = [...specific, ...generic];
  return out.length ? out : media;
}

export const discountPct = (v: Pick<Variant, "pricePaise" | "mrpPaise">) => (v.mrpPaise > v.pricePaise ? Math.round(((v.mrpPaise - v.pricePaise) / v.mrpPaise) * 100) : 0);
