"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Hit = { label: string; sub?: string; href: string };
const PAGES: [string, string, string | null][] = [["Dashboard", "/", null], ["Products", "/products", "product:read"], ["New product", "/products/new", "product:write"], ["Categories", "/categories", "category:read"], ["Inventory", "/inventory", "inventory:read"], ["Orders", "/orders", "order:read"], ["Customers", "/customers", "customer:read"], ["Offers", "/offers", "settings:read"], ["Homepage slides", "/banners", "banner:read"], ["Settings", "/settings", "settings:read"], ["Security", "/security", null]];

/** ⌘K / Ctrl+K: jump to a page, a product, or an order number. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  useEffect(() => {
    const term = q.trim();
    const pages = PAGES.filter(([l, , p]) => (!p || can(me, p)) && l.toLowerCase().includes(term.toLowerCase())).map(([label, href]) => ({ label, sub: "Page", href }));
    setHits(pages); setSel(0);
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const [prods, orders] = await Promise.all([
        can(me, "product:read") ? get<{ items: { id: string; title: string; category: string }[] }>(`/admin/products?limit=5&q=${encodeURIComponent(term)}`).catch(() => ({ items: [] })) : { items: [] },
        can(me, "order:read") ? get<{ items: { id: string; orderNumber: string; name: string | null }[] }>(`/admin/orders?limit=5&q=${encodeURIComponent(term)}`).catch(() => ({ items: [] })) : { items: [] },
      ]);
      setHits([...pages, ...prods.items.map((p) => ({ label: p.title, sub: `Product · ${p.category}`, href: `/products/${p.id}` })), ...orders.items.map((o) => ({ label: o.orderNumber, sub: `Order · ${o.name ?? ""}`, href: `/orders/${o.id}` }))]);
    }, 200);
    return () => clearTimeout(t);
  }, [q, me]);

  if (!open) return null;
  const go = (h?: Hit) => { if (h) { router.push(h.href); onClose(); } };
  return (
    <div role="dialog" aria-modal="true" aria-label="Search" className="fixed inset-0 z-50 flex items-start justify-center bg-navy/50 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-md">
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, products, order numbers…" aria-label="Search" className="w-full border-b border-line px-5 py-4 text-base outline-none"
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); } else if (e.key === "Enter") go(hits[sel]); }} />
        <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
          {hits.map((h, i) => <li key={h.href + h.label} role="option" aria-selected={i === sel}><button onMouseEnter={() => setSel(i)} onClick={() => go(h)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${i === sel ? "bg-soft" : ""}`}><span className="font-semibold">{h.label}</span><span className="text-xs text-muted">{h.sub}</span></button></li>)}
          {hits.length === 0 && <li className="p-6 text-center text-sm text-muted">Nothing found.</li>}
        </ul>
      </div>
    </div>
  );
}
