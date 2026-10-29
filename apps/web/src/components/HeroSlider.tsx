"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type HeroSlide = { eyebrow: string; title: string; text: string; cta: string; href: string; image: string; bg: string };

/** Built-in hero: one product per slide on a flat colour. Autoplays; pauses on hover/focus and for reduced motion. */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  const go = (d: number) => setI((n) => (n + d + slides.length) % slides.length);

  return (
    <section aria-roledescription="carousel" aria-label="Featured collections" className="relative overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="flex transition-transform duration-700 ease-[var(--ease-drawer)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <div key={s.href} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${slides.length}`} aria-hidden={k !== i} className="w-full shrink-0" style={{ background: s.bg }}>
            <div className="mx-auto grid max-w-7xl items-center gap-2 px-4 py-8 md:grid-cols-2 md:py-10">
              <div className="order-2 pb-8 md:order-1 md:pb-0 md:pl-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">{s.eyebrow}</p>
                <h2 className="max-w-lg text-4xl leading-[1.1] text-ink md:text-5xl">{s.title}</h2>
                <p className="mt-4 max-w-md text-base text-muted">{s.text}</p>
                <Link href={s.href} tabIndex={k === i ? 0 : -1} className="mt-7 inline-flex min-h-12 items-center rounded-sm bg-navy px-8 text-sm font-semibold text-white transition-colors hover:bg-navy-2">{s.cta}</Link>
              </div>
              <img src={s.image} alt="" width={800} height={700} fetchPriority={k === 0 ? "high" : "auto"} loading={k === 0 ? "eager" : "lazy"} className="order-1 mx-auto max-h-[22rem] w-auto md:order-2 md:max-h-[26rem]" />
            </div>
          </div>
        ))}
      </div>
      <button aria-label="Previous slide" onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-sm bg-white/90 text-xl text-ink hover:bg-white md:grid">‹</button>
      <button aria-label="Next slide" onClick={() => go(1)} className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-sm bg-white/90 text-xl text-ink hover:bg-white md:grid">›</button>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">{slides.map((s, k) => <button key={s.href} aria-label={`Slide ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={`h-1.5 transition-all ${k === i ? "w-8 bg-navy" : "w-4 bg-navy/30"}`} />)}</div>
    </section>
  );
}
