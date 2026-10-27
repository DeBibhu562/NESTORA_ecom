"use client";
import { Badge, Button, Stepper, formatPaise } from "@app/ui";
import { useMemo, useState } from "react";
import type { ProductDetail } from "@/lib/api";
import { ENGRAVING_NOTE, FREE_SHIPPING_ABOVE_PAISE } from "@/lib/store";
import { discountPct, galleryFor, initialVariant, resolveVariant, selectValue, selectionOf, valueInStock } from "@/lib/variants";
import { Gallery } from "./Gallery";
import { StockAlert } from "./StockAlert";

/** Gallery + buy box share one selection so images, price, stock and URL follow the chosen variant without a page load. */
export function ProductHero({ product: p, initialSku }: { product: ProductDetail; initialSku?: string }) {
  const [sel, setSel] = useState(() => { const v = initialVariant(p.variants, initialSku); return v ? selectionOf(p.options, v) : {}; });
  const [qty, setQty] = useState(1);
  const variant = useMemo(() => resolveVariant(p.variants, p.options, sel), [p, sel]);
  const images = useMemo(() => galleryFor(p.media, variant, sel), [p.media, variant, sel]);
  const pct = variant ? discountPct(variant) : 0;
  const maxQty = Math.max(1, variant?.maxQty ?? 1);

  const choose = (optionId: string, valueId: string) => {
    const next = selectValue(p.variants, p.options, sel, optionId, valueId);
    setSel(next); setQty(1);
    const v = resolveVariant(p.variants, p.options, next);
    if (v) window.history.replaceState(null, "", `?variant=${encodeURIComponent(v.sku)}`); // shareable, no navigation
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Gallery key={images.map((m) => m.id).join()} images={images} title={p.title} />

      <div className="space-y-5">
        <div>
          {p.badges.length > 0 && <div className="mb-2 flex gap-2">{p.badges.map((b) => <Badge key={b} tone="sale">{b}</Badge>)}</div>}
          <h1 className="text-3xl md:text-4xl">{p.title}</h1>
          {p.tagline && <p className="mt-1 text-muted">{p.tagline}</p>}
          {p.ratingCount > 0 && <p className="mt-1 text-sm"><span className="text-gold" aria-hidden>★</span> {p.ratingAvg.toFixed(1)} <span className="text-muted">({p.ratingCount} reviews)</span></p>}
        </div>

        {variant && (
          <div>
            <p className="flex flex-wrap items-baseline gap-x-3" aria-live="polite" aria-atomic="true">
              <span className="text-3xl font-bold text-brand">{formatPaise(variant.pricePaise)}</span>
              {pct > 0 && <><s className="text-muted">{formatPaise(variant.mrpPaise)}</s><Badge tone="discount">{pct}% OFF</Badge></>}
            </p>
            <p className="mt-1 text-xs text-muted">{pct > 0 && <>You save {formatPaise(variant.mrpPaise - variant.pricePaise)}. </>}Inclusive of all taxes. Free shipping above {formatPaise(FREE_SHIPPING_ABOVE_PAISE)}.</p>
          </div>
        )}

        {p.options.map((o) => {
          const current = o.values.find((v) => v.id === sel[o.id]);
          return (
            <fieldset key={o.id} className="space-y-2">
              <legend className="text-sm font-semibold">{o.name}: <span className="font-normal text-muted">{current?.value}</span></legend>
              {o.displayAs === "DROPDOWN" ? (
                <select aria-label={o.name} value={sel[o.id]} onChange={(e) => choose(o.id, e.target.value)} className="min-h-11 rounded-lg border border-line px-3">
                  {o.values.map((v) => <option key={v.id} value={v.id}>{v.value}</option>)}
                </select>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {o.values.map((v) => {
                    const on = sel[o.id] === v.id, stocked = valueInStock(p.variants, p.options, sel, o.id, v.id);
                    const label = `${v.value}${stocked ? "" : " (sold out)"}`;
                    return o.displayAs === "SWATCH" ? (
                      <button key={v.id} type="button" aria-label={label} aria-pressed={on} title={label} onClick={() => choose(o.id, v.id)}
                        className={`relative size-10 overflow-hidden rounded-full border border-line ${on ? "ring-2 ring-ink ring-offset-2" : ""} ${stocked ? "" : "opacity-50"}`} style={{ background: v.hexColor ?? "#ddd" }}>
                        {!stocked && <span aria-hidden className="absolute left-1/2 top-0 h-full w-px origin-center rotate-45 bg-ink" />}
                      </button>
                    ) : (
                      <button key={v.id} type="button" aria-pressed={on} aria-label={label} onClick={() => choose(o.id, v.id)}
                        className={`min-h-11 rounded-full border px-5 text-sm font-semibold transition-transform ${on ? "scale-[1.02] border-navy bg-navy text-white" : "border-line hover:bg-soft"} ${stocked ? "" : "text-muted line-through"}`}>
                        {v.value}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}

        {!variant && <p role="alert" className="text-sm text-brand">This combination is not available.</p>}
        {variant && !variant.inStock && <p role="status" className="text-sm font-semibold text-brand">Out of stock</p>}
        {variant && variant.inStock && variant.maxQty <= 5 && <p role="status" className="text-sm font-semibold text-brand">Only {variant.maxQty} left</p>}
        {p.personalization && <p className="text-sm text-muted">✎ {ENGRAVING_NOTE}{p.personalization.pricePaise ? ` (+${formatPaise(p.personalization.pricePaise)})` : ""}</p>}

        {variant?.inStock ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Stepper value={qty} onChange={setQty} min={1} max={maxQty} />
              {/* shortcut: cart & checkout land in Phase 3; the buttons exist so layout/accessibility are final */}
              <Button disabled className="flex-1">Add to cart</Button>
            </div>
            <Button variant="secondary" disabled className="w-full">Buy it now</Button>
            <p className="text-xs text-muted">Cart and checkout arrive in the next release.</p>
          </div>
        ) : variant ? <StockAlert variantId={variant.id} /> : null}

        <ul className="grid grid-cols-3 gap-2 border-t border-line pt-4 text-center text-xs text-muted" aria-label="Our promise">
          <li>🚚<br />Fast delivery</li><li>↩<br />7-day returns</li><li>🔒<br />Secure payment</li>
        </ul>
        {variant && <p className="text-xs text-muted">SKU: {variant.sku}</p>}
      </div>
    </div>
  );
}
