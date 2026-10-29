"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { formatPaise } from "@app/ui";
import { API, type Card } from "@/lib/api";

export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<Card[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  useEffect(() => { // debounced predictive search; stale responses are ignored
    const term = q.trim();
    if (term.length < 2) { setItems([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/catalog/suggest?q=${encodeURIComponent(term)}`);
        if (r.ok && mine === seq.current) { setItems((await r.json()).items); setActive(-1); }
      } catch { /* suggestions are best-effort */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (e?: FormEvent) => {
    e?.preventDefault();
    const hit = items[active];
    setOpen(false);
    router.push(hit ? `/p/${hit.slug}` : `/search?q=${encodeURIComponent(q.trim())}`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); setOpen(true);
      setActive((a) => (items.length ? (a + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : -1));
    }
  };

  const show = open && items.length > 0;
  return (
    <form role="search" onSubmit={go} className="relative w-full" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        placeholder="What are you looking for?" aria-label="Search products" autoComplete="off" role="combobox"
        aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        className="min-h-11 w-full rounded-sm border border-line bg-soft px-5 text-sm focus-visible:outline-2 focus-visible:outline-brand"
      />
      {show && (
        <ul id={`${id}-list`} role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-12 z-40 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          {items.map((c, i) => (
            <li key={c.id} id={`${id}-${i}`} role="option" aria-selected={i === active}>
              <a href={`/p/${c.slug}`} onClick={(e) => { e.preventDefault(); setOpen(false); router.push(`/p/${c.slug}`); }} className={`flex items-center gap-3 px-3 py-2 text-sm ${i === active ? "bg-soft" : "hover:bg-soft"}`}>
                {c.image ? <img src={c.image.url} alt="" width={40} height={40} className="size-10 rounded bg-soft object-cover" /> : <span className="size-10 rounded bg-soft" />}
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.title}</span><span className="text-xs text-muted">{c.categoryName}</span></span>
                <span className="font-semibold">{formatPaise(c.minPricePaise)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
