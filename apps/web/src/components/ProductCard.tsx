"use client";
import { Badge, formatPaise } from "@app/ui";
import Link from "next/link";
import { useState } from "react";
import type { Card } from "@/lib/api";

export function ProductCard({ card, priority = false }: { card: Card; priority?: boolean }) {
  const [sw, setSw] = useState<string | null>(null);
  const picked = card.swatches.find((s) => s.value === sw);
  const src = picked?.image ?? card.image?.url;
  const range = card.minPricePaise !== card.maxPricePaise;

  return (
    <article className="group relative flex w-full flex-col rounded-2xl bg-soft p-3 transition-shadow focus-within:shadow-md hover:shadow-md">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
        {src ? <img src={src} alt={picked ? `${card.title} in ${picked.value}` : card.image?.alt ?? card.title} width={card.image?.width ?? 600} height={card.image?.height ?? 600} loading={priority ? "eager" : "lazy"} className="size-full object-cover transition-opacity duration-150" /> : null}
        {!picked && card.hoverImage && <img src={card.hoverImage.url} alt="" aria-hidden loading="lazy" className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
        {card.discountPct > 0 && card.inStock && <Badge tone="discount" className="absolute left-2 top-2">{card.discountPct}% OFF</Badge>}
        {!card.inStock && <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-xs font-semibold text-white">Sold out</span>}
        {card.badges[0] && <Badge tone="sale" className="absolute right-2 top-2">{card.badges[0]}</Badge>}
      </div>
      <h3 className="mt-3 text-sm font-semibold leading-snug">
        <Link href={`/p/${card.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-brand">{card.title}</Link>
      </h3>
      {card.ratingCount > 0 && <p className="text-xs text-muted"><span className="text-gold" aria-hidden>★</span> {card.ratingAvg.toFixed(1)} ({card.ratingCount})</p>}
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-base font-bold text-brand">{range ? "From " : ""}{formatPaise(card.minPricePaise)}</span>
        {card.discountPct > 0 && <s className="text-xs text-muted">{formatPaise(card.mrpPaise)}</s>}
      </p>
      {card.swatches.length > 0 && (
        <div role="group" aria-label="Colours" className="relative z-10 mt-2 flex flex-wrap gap-1.5">
          {card.swatches.slice(0, 6).map((s) => (
            <button key={s.value} type="button" aria-label={`${s.value}${s.inStock ? "" : " (sold out)"}`} aria-pressed={sw === s.value}
              onMouseEnter={() => setSw(s.value)} onFocus={() => setSw(s.value)} onClick={() => setSw(s.value)}
              className={`size-5 rounded-full border ${sw === s.value ? "ring-2 ring-ink ring-offset-1" : "border-line"} ${s.inStock ? "" : "opacity-40"}`} style={{ background: s.hex ?? "#ddd" }} />
          ))}
          {card.swatches.length > 6 && <span className="text-xs text-muted">+{card.swatches.length - 6}</span>}
        </div>
      )}
    </article>
  );
}
