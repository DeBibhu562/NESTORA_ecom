"use client";
import { Badge, Button } from "@app/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Input, Problems, Select } from "@/components/form";
import { get } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { can, useMe } from "@/lib/me";

type Row = { id: string; title: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; category: string; image: { url: string; alt: string } | null; variantCount: number; minPricePaise: number | null; available: number };

export default function Products() {
  const me = useMe();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async (cursor?: string) => {
    try {
      const p = new URLSearchParams({ limit: "25", ...(q && { q }), ...(status && { status }), ...(cursor && { cursor }) });
      const r = await get<{ items: Row[]; nextCursor: string | null }>(`/admin/products?${p}`);
      setRows((old) => (cursor ? [...old, ...r.items] : r.items));
      setNext(r.nextCursor); setError(undefined);
    } catch (e) { setError(e); }
  }, [q, status]);

  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]); // debounce search

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Products</h1>
        {can(me, "product:write") && <Link href="/products/new"><Button>New product</Button></Link>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search by title" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-40"><option value="">All statuses</option><option>ACTIVE</option><option>DRAFT</option><option>ARCHIVED</option></Select>
      </div>
      <Problems error={error} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted"><tr><th className="p-3">Product</th><th>Status</th><th>Category</th><th>Variants</th><th>From</th><th>Available</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-soft">
                <td className="p-3"><Link href={`/products/${r.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                  {r.image ? <img src={r.image.url} alt="" className="size-10 rounded bg-soft object-cover" /> : <span className="size-10 rounded bg-soft" />}{r.title}</Link></td>
                <td><Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>{r.status}</Badge></td>
                <td>{r.category}</td><td>{r.variantCount}</td>
                <td>{r.minPricePaise ? formatPaise(r.minPricePaise) : "–"}</td>
                <td className={r.available <= 0 ? "text-brand" : ""}>{r.available}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
      {next && <Button variant="ghost" onClick={() => void load(next)}>Load more</Button>}
    </div>
  );
}
