"use client";
import { formatPaise } from "@app/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Input, Problems } from "@/components/form";
import { get } from "@/lib/api";

type Row = { id: string; returnNumber: string; status: string; reason: string; refundPaise: number | null; createdAt: string; order: { orderNumber: string; phone: string; shippingAddress: { name?: string } } };
const FILTERS = [["", "All"], ["REQUESTED", "New"], ["APPROVED", "Approved"], ["PICKUP_SCHEDULED", "Pickup booked"], ["RECEIVED", "Received"], ["REFUNDED", "Refunded"], ["REJECTED", "Rejected"]];
const TONE: Record<string, string> = { REQUESTED: "bg-amber-100 text-amber-800", APPROVED: "bg-sky-100 text-sky-800", PICKUP_SCHEDULED: "bg-indigo-100 text-indigo-800", RECEIVED: "bg-violet-100 text-violet-800", REFUNDED: "bg-emerald-100 text-emerald-800", REJECTED: "bg-red-100 text-red-800" };
const words = (s: string) => s.replace(/_/g, " ").toLowerCase();

export default function Returns() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<unknown>();
  useEffect(() => { const t = setTimeout(() => get<Row[]>(`/admin/returns?${new URLSearchParams({ ...(status && { status }), ...(q && { q }) })}`).then((r) => { setRows(r); setError(undefined); }).catch(setError), 200); return () => clearTimeout(t); }, [status, q]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Returns</h1>
      <div role="tablist" aria-label="Return status" className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map(([v, l]) => <button key={v} role="tab" aria-selected={status === v} onClick={() => setStatus(v ?? "")} className={`min-h-9 whitespace-nowrap rounded-sm px-4 text-sm font-semibold ${status === v ? "bg-navy text-white" : "bg-white text-muted shadow-card hover:text-ink"}`}>{l}</button>)}</div>
      <Input placeholder="Return or order number" aria-label="Search returns" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <Problems error={error} />
      <div className="overflow-x-auto rounded-xl bg-white shadow-card">
        <table className="w-full min-w-[40rem] text-left text-sm"><caption className="sr-only">Returns</caption>
          <thead className="border-b border-line bg-soft/60 text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Return</th><th>Order</th><th>Customer</th><th>Reason</th><th>Status</th><th className="p-3 text-right">Refund</th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="p-3"><div className="h-8 animate-pulse rounded bg-soft" /></td></tr>}
            {rows?.map((r) => <tr key={r.id} className="border-t border-line hover:bg-soft"><td className="p-3"><Link href={`/returns/${r.id}`} className="font-semibold hover:underline">{r.returnNumber}</Link><br /><span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span></td><td>{r.order.orderNumber}</td><td>{r.order.shippingAddress.name}</td><td className="capitalize">{words(r.reason)}</td><td><span className={`rounded-sm px-2 py-0.5 text-xs font-semibold capitalize ${TONE[r.status] ?? "bg-soft"}`}>{words(r.status)}</span></td><td className="p-3 text-right font-semibold">{r.refundPaise ? formatPaise(r.refundPaise) : "–"}</td></tr>)}
            {rows?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">No returns here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
