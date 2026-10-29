"use client";
import { Badge, Button } from "@app/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Input, Problems, Select } from "@/components/form";
import { useFeedback } from "@/components/feedback";
import { ApiError, del, flattenCategories, get, post, type Category } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { can, useMe } from "@/lib/me";

type Status = "DRAFT" | "ACTIVE" | "ARCHIVED";
type Row = { id: string; title: string; status: Status; category: string; image: { url: string; alt: string } | null; variantCount: number; minPricePaise: number | null; available: number };

export default function Products() {
  const me = useMe();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const canWrite = can(me, "product:write");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cats, setCats] = useState<(Category & { depth: number })[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<unknown>();

  const load = useCallback(async (cursor?: string) => {
    try {
      const p = new URLSearchParams({ limit: "25", ...(q && { q }), ...(status && { status }), ...(categoryId && { categoryId }), ...(cursor && { cursor }) });
      const r = await get<{ items: Row[]; nextCursor: string | null; total: number }>(`/admin/products?${p}`);
      setRows((old) => (cursor && old ? [...old, ...r.items] : r.items));
      setNext(r.nextCursor); setTotal(r.total); setError(undefined);
      if (!cursor) setPicked(new Set());
    } catch (e) { setError(e); setRows((old) => old ?? []); }
  }, [q, status, categoryId]);

  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]); // debounce search
  useEffect(() => { if (can(me, "category:read")) get<Category[]>("/admin/categories").then((t) => setCats(flattenCategories(t))).catch(() => undefined); }, [me]);

  const fail = (e: unknown) => toast(e instanceof ApiError ? e.lines.join(" ") : "Something went wrong", "error");

  async function bulk(s: Status) {
    const ids = [...picked];
    const label = { ACTIVE: "Publish", DRAFT: "Unpublish", ARCHIVED: "Archive" }[s];
    if (!(await confirm({ title: `${label} ${ids.length} product${ids.length === 1 ? "" : "s"}?`, confirmLabel: label, danger: s === "ARCHIVED" }))) return;
    try {
      const r = await post<{ updated: number; failed: { id: string; message: string }[] }>("/admin/products/bulk-status", { ids, status: s });
      const name = (id: string) => rows?.find((x) => x.id === id)?.title ?? id;
      toast(`${r.updated} updated${r.failed.length ? `, ${r.failed.length} skipped: ${r.failed.map((f) => `${name(f.id)} (${f.message})`).join("; ")}` : ""}`, r.failed.length ? "error" : "ok");
      void load();
    } catch (e) { fail(e); }
  }

  async function remove(r: Row) {
    if (!(await confirm({ title: `Delete “${r.title}”?`, body: "It disappears from the store and this list. Past orders keep their record.", confirmLabel: "Delete", danger: true }))) return;
    try { await del(`/admin/products/${r.id}`); toast("Product deleted. Find it under the Deleted filter to restore.", "ok"); void load(); } catch (e) { fail(e); }
  }

  async function restore(r: Row) {
    try { await post(`/admin/products/${r.id}/restore`); toast(`“${r.title}” restored as Archived. Publish it when ready.`); void load(); } catch (e) { fail(e); }
  }

  async function duplicate(r: Row) {
    try { const p = await post<{ id: string }>(`/admin/products/${r.id}/duplicate`); toast("Duplicated as a draft. Add images before publishing."); router.push(`/products/${p.id}`); } catch (e) { fail(e); }
  }

  const deletedView = status === "DELETED";
  const all = !!rows?.length && picked.size === rows.length;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Products <span className="text-base font-normal text-muted">{rows ? `${total} total` : ""}</span></h1>
        {canWrite && <Link href="/products/new"><Button>New product</Button></Link>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search by title" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-40"><option value="">All statuses</option><option>ACTIVE</option><option>DRAFT</option><option>ARCHIVED</option><option value="DELETED">DELETED</option></Select>
        {cats.length > 0 && <Select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="max-w-56"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{"– ".repeat(c.depth)}{c.name}</option>)}</Select>}
      </div>
      <Problems error={error} />
      {canWrite && !deletedView && picked.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-xl bg-navy p-3 text-sm text-white">
          <span className="mr-2 font-semibold">{picked.size} selected</span>
          <Button variant="secondary" onClick={() => bulk("ACTIVE")}>Publish</Button>
          <Button variant="secondary" onClick={() => bulk("DRAFT")}>Unpublish</Button>
          <Button variant="secondary" onClick={() => bulk("ARCHIVED")}>Archive</Button>
          <Button variant="ghost" className="!text-white" onClick={() => setPicked(new Set())}>Clear</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Products</caption>
          <thead className="border-b border-line bg-soft/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              {canWrite && !deletedView && <th scope="col" className="w-10 p-3"><input type="checkbox" aria-label="Select all loaded products" checked={all} onChange={() => setPicked(all ? new Set() : new Set(rows!.map((r) => r.id)))} className="size-4" /></th>}
              <th scope="col" className="p-3">Product</th><th scope="col">Status</th><th scope="col">Category</th><th scope="col">Variants</th><th scope="col">From</th><th scope="col">Available</th>
              {canWrite && <th scope="col" className="p-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null && Array.from({ length: 6 }, (_, i) => <tr key={i} className="border-b border-line"><td colSpan={8} className="p-3"><div className="h-10 animate-pulse rounded bg-soft" /></td></tr>)}
            {rows?.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-soft">
                {canWrite && !deletedView && <td className="p-3"><input type="checkbox" aria-label={`Select ${r.title}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="size-4" /></td>}
                <td className="p-3">
                  {(() => {
                    const inner = <>{r.image ? <img src={r.image.url} alt="" width={40} height={40} loading="lazy" className="size-12 rounded-lg bg-soft object-cover" /> : <span className="size-12 rounded-lg bg-soft" />}{r.title}</>;
                    return deletedView ? <span className="flex items-center gap-3 text-muted">{inner}</span> : <Link href={`/products/${r.id}`} className="flex items-center gap-3 font-semibold hover:underline">{inner}</Link>; // deleted products have no editor page
                  })()}
                </td>
                <td><Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>{r.status}</Badge></td>
                <td>{r.category}</td><td>{r.variantCount}</td>
                <td>{r.minPricePaise ? formatPaise(r.minPricePaise) : "–"}</td>
                <td><span className={`rounded-sm px-2.5 py-0.5 text-xs font-semibold ${r.available <= 0 ? "bg-red-100 text-red-800" : r.available < 10 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{r.available <= 0 ? "Out of stock" : r.available}</span></td>
                {canWrite && <td className="space-x-3 whitespace-nowrap p-3 text-right">
                  {deletedView
                    ? <button type="button" onClick={() => restore(r)} aria-label={`Restore ${r.title}`} className="min-h-11 font-semibold underline">Restore</button>
                    : <>
                        <Link href={`/products/${r.id}`} aria-label={`Edit ${r.title}`} className="inline-flex min-h-9 items-center rounded-sm bg-navy px-4 text-xs font-semibold text-white transition hover:bg-navy-2">Edit</Link>
                        <button type="button" onClick={() => duplicate(r)} aria-label={`Duplicate ${r.title}`} className="min-h-11 underline">Duplicate</button>
                        <button type="button" onClick={() => remove(r)} aria-label={`Delete ${r.title}`} className="min-h-11 text-brand underline">Delete</button>
                      </>}
                </td>}
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted">{deletedView ? "No deleted products." : q || status || categoryId ? "No products match these filters." : "No products yet."}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows && <p className="text-xs text-muted" aria-live="polite">Showing {rows.length} of {total}</p>}
      {next && <Button variant="ghost" onClick={() => void load(next)}>Load more</Button>}
    </div>
  );
}
