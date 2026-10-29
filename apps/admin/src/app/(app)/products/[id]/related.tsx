"use client";
import { useEffect, useState } from "react";
import { Input, Problems } from "@/components/form";
import { get, put, type Product } from "@/lib/api";

type Item = { id: string; title: string; status: string; image: string | null };
type Hit = { id: string; title: string; image: { url: string } | null };

/** Hand-picked products shown first in "You may also like"; the store fills the rest from the same category. */
export function Related({ p, canWrite }: { p: Product; canWrite: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);

  useEffect(() => { get<Item[]>(`/admin/products/${p.id}/related`).then(setItems).catch(setError); }, [p.id]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => get<{ items: Hit[] }>(`/admin/products?status=ACTIVE&limit=8&q=${encodeURIComponent(q.trim())}`).then((r) => setHits(r.items.filter((h) => h.id !== p.id))).catch(() => undefined), 250);
    return () => clearTimeout(t);
  }, [q, p.id]);

  const save = async (next: Item[]) => {
    setItems(next); setSaved(false); setError(undefined);
    try { await put(`/admin/products/${p.id}/related`, { ids: next.map((i) => i.id) }); setSaved(true); } catch (e) { setError(e); }
  };
  const move = (i: number, d: number) => { const n = [...items!]; [n[i], n[i + d]] = [n[i + d]!, n[i]!]; void save(n); };

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted">Pick up to 8 products to show first under “You may also like”. Leave empty to use the same category automatically.</p>
      <Problems error={error} />
      <ul className="space-y-2">
        {items?.map((it, i) => (
          <li key={it.id} className="flex items-center gap-3 rounded-xl bg-soft p-2">
            {it.image ? <img src={it.image} alt="" className="size-12 rounded-lg object-cover" /> : <span className="size-12 rounded-lg bg-white" />}
            <span className="flex-1 text-sm font-semibold">{it.title}{it.status !== "ACTIVE" && <span className="ml-2 text-xs font-normal text-muted">({it.status.toLowerCase()}, hidden on store)</span>}</span>
            {canWrite && <span className="flex gap-1 text-sm"><button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="size-9 rounded-full hover:bg-white disabled:opacity-30">↑</button><button aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="size-9 rounded-full hover:bg-white disabled:opacity-30">↓</button><button aria-label={`Remove ${it.title}`} onClick={() => void save(items.filter((x) => x.id !== it.id))} className="size-9 rounded-full text-brand hover:bg-white">✕</button></span>}
          </li>
        ))}
        {items?.length === 0 && <li className="text-sm text-muted">Nothing picked yet.</li>}
      </ul>
      {canWrite && (items?.length ?? 0) < 8 && (
        <div className="space-y-2">
          <Input placeholder="Search products to add…" aria-label="Search products to add" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="space-y-1">{hits.filter((h) => !items?.some((i) => i.id === h.id)).map((h) => (
            <li key={h.id}><button onClick={() => { void save([...(items ?? []), { id: h.id, title: h.title, status: "ACTIVE", image: h.image?.url ?? null }]); setQ(""); }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-sm hover:bg-soft">{h.image ? <img src={h.image.url} alt="" className="size-10 rounded-lg object-cover" /> : <span className="size-10 rounded-lg bg-soft" />}<span className="flex-1 font-semibold">{h.title}</span><span className="text-brand">+ Add</span></button></li>
          ))}</ul>
        </div>
      )}
      {saved && <p role="status" className="text-sm text-success">Saved</p>}
    </div>
  );
}
