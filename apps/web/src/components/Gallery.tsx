"use client";
import { useRef, useState } from "react";
import type { MediaItem } from "@/lib/api";

/** Main image + thumbnails; arrows, thumbnails and swipe all change the image. Remount (via key) to reset when the image set changes. */
export function Gallery({ images, title }: { images: MediaItem[]; title: string }) {
  const [i, setI] = useState(0);
  const down = useRef<number | null>(null);
  if (!images.length) return <div className="grid aspect-square place-items-center rounded-2xl bg-soft text-sm text-muted">No image</div>;
  const n = images.length, cur = images[Math.min(i, n - 1)]!;
  const step = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      <div className="group relative flex-1 self-start touch-pan-y select-none overflow-hidden bg-soft"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`); e.currentTarget.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`); }}
        onPointerDown={(e) => { down.current = e.clientX; }}
        onPointerUp={(e) => { if (down.current !== null && Math.abs(e.clientX - down.current) > 40 && n > 1) step(e.clientX < down.current ? 1 : -1); down.current = null; }}>
        <img key={cur.url} src={cur.url} alt={cur.alt || title} width={cur.width} height={cur.height} draggable={false} fetchPriority="high" className="aspect-square w-full origin-[var(--zx,50%)_var(--zy,50%)] animate-[fade_150ms_ease-out] object-cover transition-transform duration-300 md:group-hover:scale-150" />
        {n > 1 && (
          <>
            <button aria-label="Previous image" onClick={() => step(-1)} className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow hover:bg-white">‹</button>
            <button aria-label="Next image" onClick={() => step(1)} className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow hover:bg-white">›</button>
            <p className="absolute bottom-2 right-3 rounded-sm bg-ink/70 px-2 py-0.5 text-xs text-white" aria-live="polite">{Math.min(i, n - 1) + 1} / {n}</p>
          </>
        )}
      </div>
      {n > 1 && (
        <ul className="flex gap-2 overflow-x-auto md:flex-col" aria-label="Product images">
          {images.map((m, k) => (
            <li key={m.id}>
              <button onClick={() => setI(k)} aria-label={`Show image ${k + 1}`} aria-current={k === i} className={`block size-16 overflow-hidden rounded-xl border-2 bg-soft transition md:size-20 ${k === i ? "border-brand shadow-card" : "border-transparent opacity-70 hover:opacity-100"}`}>
                <img src={m.url} alt="" width={64} height={64} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
