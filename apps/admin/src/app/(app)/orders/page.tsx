"use client";
import { Button, formatPaise } from "@app/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Input, Problems } from "@/components/form";
import { get } from "@/lib/api";

type Row = { id: string; orderNumber: string; status: string; name: string | null; city: string | null; phone: string; totalPaise: number; createdAt: string; payments: { method: string; status: string }[] };
type Queues = { new: number; toPack: number; toShip: number; inTransit: number; delivered: number; delayed: number; returns: number; refunds: number };
const TABS: { key: string; label: string; status?: string; delayed?: boolean; count?: keyof Queues; hot?: boolean }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "Needs confirming", status: "PLACED", count: "new", hot: true },
  { key: "pack", label: "To pack", status: "CONFIRMED", count: "toPack" },
  { key: "ship", label: "To ship", status: "PROCESSING", count: "toShip" },
  { key: "transit", label: "In transit", status: "SHIPPED", count: "inTransit" },
  { key: "delayed", label: "Delayed", delayed: true, count: "delayed", hot: true },
  { key: "delivered", label: "Delivered", status: "DELIVERED", count: "delivered" },
  { key: "cancelled", label: "Cancelled", status: "CANCELLED" },
];
const TONE: Record<string, string> = { PENDING_PAYMENT: "bg-amber-100 text-amber-800", PLACED: "bg-sky-100 text-sky-800", CONFIRMED: "bg-sky-100 text-sky-800", PROCESSING: "bg-indigo-100 text-indigo-800", SHIPPED: "bg-violet-100 text-violet-800", DELIVERED: "bg-emerald-100 text-emerald-800", CANCELLED: "bg-red-100 text-red-800" };
const label = (s: string) => s.replace("_", " ").toLowerCase();

export default function Orders() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [queues, setQueues] = useState<Queues | null>(null);
  const cur = TABS.find((t) => t.key === tab)!;
  const status = cur.status ?? "";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async (cursor?: string) => {
    try {
      const p = new URLSearchParams({ limit: "30", ...(q && { q }), ...(status && { status }), ...(cur.delayed && { delayed: "true" }), ...(from && { from }), ...(to && { to }), ...(cursor && { cursor }) });
      const r = await get<{ items: Row[]; nextCursor: string | null }>(`/admin/orders?${p}`);
      setRows((o) => (cursor && o ? [...o, ...r.items] : r.items)); setNext(r.nextCursor); setError(undefined);
    } catch (e) { setError(e); setRows((o) => o ?? []); }
  }, [q, status, cur.delayed, from, to]);
  useEffect(() => { get<Queues>("/admin/orders/queues").then(setQueues).catch(() => undefined); }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  // Exports what is on screen (already masked server-side unless the viewer may reveal customer data).
  const exportCsv = () => {
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Order", "Placed", "Customer", "City", "Phone", "Payment", "Status", "Total (INR)"], ...(rows ?? []).map((o) => [o.orderNumber, o.createdAt, o.name, o.city, o.phone, `${o.payments[0]?.method ?? ""} ${o.payments[0]?.status ?? ""}`, o.status, o.totalPaise / 100])];
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([lines.map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" })), download: `orders-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Orders</h1>
        <Button variant="ghost" onClick={exportCsv} disabled={!rows?.length}>Export CSV</Button>
      </div>
      <div role="tablist" aria-label="Order queues" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => { const n = t.count && queues ? queues[t.count] : null; return <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`flex min-h-9 items-center gap-2 whitespace-nowrap rounded-sm px-4 text-sm font-semibold transition ${tab === t.key ? "bg-navy text-white" : "bg-white text-muted shadow-card hover:text-ink"}`}>{t.label}{n ? <span className={`rounded-sm px-1.5 text-xs ${tab === t.key ? "bg-white/20" : t.hot ? "bg-brand text-white" : "bg-soft"}`}>{n}</span> : null}</button>; })}
        <Link href="/returns" className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-sm border border-line px-4 text-sm font-semibold hover:bg-white">Returns{queues?.returns ? <span className="rounded-sm bg-brand px-1.5 text-xs text-white">{queues.returns}</span> : null}</Link>
        <Link href="/refunds" className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-sm border border-line px-4 text-sm font-semibold hover:bg-white">Refunds to pay{queues?.refunds ? <span className="rounded-sm bg-brand px-1.5 text-xs text-white">{queues.refunds}</span> : null}</Link>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input placeholder="Order number or phone" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <label className="text-xs text-muted">From<Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted">To<Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        {(q || from || to || tab !== "all") && <button className="min-h-11 text-sm underline" onClick={() => { setQ(""); setFrom(""); setTo(""); setTab("all"); }}>Clear</button>}
      </div>
      <Problems error={error} />
      <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Orders</caption>
          <thead className="border-b border-line bg-soft/60 text-xs uppercase tracking-wide text-muted"><tr><th scope="col" className="p-3">Order</th><th scope="col">Placed</th><th scope="col">Customer</th><th scope="col">Payment</th><th scope="col">Status</th><th scope="col" className="p-3 text-right">Total</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="p-3"><div className="h-8 animate-pulse rounded bg-soft" /></td></tr>}
            {rows?.map((o) => (
              <tr key={o.id} className="border-t border-line hover:bg-soft">
                <td className="p-3"><Link href={`/orders/${o.id}`} className="font-semibold hover:underline">{o.orderNumber}</Link></td>
                <td className="text-muted">{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td><span className="font-semibold">{o.name ?? "–"}</span><br /><span className="text-xs text-muted">{o.city ? `${o.city} · ` : ""}{o.phone}</span></td>
                <td>{o.payments[0]?.method === "COD" ? "COD" : "Online"} <span className="text-muted">· {o.payments[0]?.status.toLowerCase().replace("_", " ") ?? "none"}</span></td>
                <td><span className={`rounded-sm px-2.5 py-0.5 text-xs font-semibold capitalize ${TONE[o.status] ?? "bg-soft"}`}>{label(o.status)}</span></td>
                <td className="p-3 text-right font-semibold">{formatPaise(o.totalPaise)}</td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">No orders match.</td></tr>}
          </tbody>
        </table>
      </div>
      {next && <Button variant="ghost" onClick={() => void load(next)}>Load more</Button>}
    </div>
  );
}
