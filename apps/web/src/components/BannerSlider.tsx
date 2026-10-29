"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export type Slide = { id: string; title: string | null; subtitle: string | null; ctaLabel: string | null; imageUrl: string; link: string | null };

/** Admin-managed hero. Auto-rotates every 6s unless the visitor prefers reduced motion or hovers it. */
export function BannerSlider({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length, paused]);
  return (
    <section aria-roledescription="carousel" aria-label="Featured offers" className="relative overflow-hidden bg-navy text-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex transition-transform duration-700 ease-[var(--ease-drawer)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <div key={s.id} className="relative min-h-[22rem] w-full shrink-0 md:min-h-[28rem]" aria-hidden={k !== i} role="group" aria-roledescription="slide">
            <img src={s.imageUrl} alt="" className="absolute inset-0 size-full object-cover" fetchPriority={k === 0 ? "high" : "auto"} />
            <div aria-hidden className="absolute inset-0 bg-navy/55" />
            <div className="relative mx-auto flex min-h-[inherit] max-w-7xl flex-col justify-center gap-4 px-4 py-12">
              <h2 className="max-w-xl text-4xl leading-tight md:text-6xl">{s.title}</h2>
              {s.subtitle && <p className="max-w-md text-lg text-white/80">{s.subtitle}</p>}
              {s.link && <div><Link href={s.link} tabIndex={k === i ? 0 : -1} className="inline-flex min-h-12 items-center rounded-sm bg-brand px-8 font-semibold transition hover:bg-brand-hover">{s.ctaLabel ?? "Shop now"}</Link></div>}
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">{slides.map((s, k) => <button key={s.id} aria-label={`Slide ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className={`h-2 rounded-full transition-all ${k === i ? "w-8 bg-white" : "w-2 bg-white/50"}`} />)}</div>}
    </section>
  );
}
