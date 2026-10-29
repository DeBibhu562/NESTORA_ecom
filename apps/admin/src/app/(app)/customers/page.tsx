"use client";
import { Button, formatPaise } from "@app/ui";
import { useCallback, useEffect, useState } from "react";
import { Input, Problems } from "@/components/form";
import { get } from "@/lib/api";

type Row = { id: string; name: string | null; email: string | null; phone: string | null; isBlocked: boolean; google: boolean; createdAt: string; orders: number; spentPaise: number; lastOrderAt: string | null };
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "–");

export default function Customers() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async (cursor?: string) => {
    try {
      const p = new URLSearchParams({ limit: "30", ...(q && { q }), ...(cursor && { cursor }) });
      const r = await get<{ items: Row[]; nextCursor: string | null; total: number }>(`/admin/customers?${p}`);
      setRows((o) => (cursor && o ? [...o, ...r.items] : r.items)); setNext(r.nextCursor); setTotal(r.total); setError(undefined);
    } catch (e) { setError(e); setRows((o) => o ?? []); }
  }, [q]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Customers <span className="text-base font-normal text-muted">{rows ? `${total} total` : ""}</span></h1>
      <Input placeholder="Search name, email or phone" aria-label="Search customers" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <Problems error={error} />
      <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Customers</caption>
          <thead className="border-b border-line bg-soft/60 text-xs uppercase tracking-wide text-muted"><tr><th scope="col" className="p-3">Customer</th><th scope="col">Contact</th><th scope="col">Orders</th><th scope="col">Spent</th><th scope="col">Last order</th><th scope="col" className="p-3">Joined</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="p-3"><div className="h-8 animate-pulse rounded bg-soft" /></td></tr>}
            {rows?.map((c) => (
              <tr key={c.id} className="border-t border-line hover:bg-soft">
                <td className="p-3"><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-brand-soft font-bold text-brand">{(c.name ?? c.email ?? "?")[0]!.toUpperCase()}</span><span><b>{c.name ?? "Unnamed"}</b>{c.isBlocked && <span className="ml-2 rounded-sm bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Blocked</span>}{c.google && <span className="ml-2 rounded-sm bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Google</span>}</span></span></td>
                <td>{c.email ?? "–"}<br /><span className="text-xs text-muted">{c.phone ?? ""}</span></td>
                <td>{c.orders}</td><td className="font-semibold">{c.spentPaise ? formatPaise(c.spentPaise) : "–"}</td><td className="text-muted">{date(c.lastOrderAt)}</td><td className="p-3 text-muted">{date(c.createdAt)}</td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {next && <Button variant="ghost" onClick={() => void load(next)}>Load more</Button>}
    </div>
  );
}
