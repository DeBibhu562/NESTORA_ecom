"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { get } from "@/lib/api";
import { formatPaise } from "@/lib/money";
import { can, useMe } from "@/lib/me";

type Range = "7d" | "30d" | "90d";
type Stats = {
  revenuePaise: number; prevRevenuePaise: number; orders: number; prevOrders: number; aovPaise: number; newCustomers: number;
  byStatus: { status: string; count: number }[]; series: { day: string; revenuePaise: number; orders: number }[];
  topProducts: { title: string; qty: number; revenuePaise: number }[]; categories: { name: string; revenuePaise: number }[];
  recent: { id: string; orderNumber: string; status: string; totalPaise: number; createdAt: string; city: string | null }[];
};
type Low = { variantId: string; sku: string; title: string; onHand: number; reserved: number };

const compact = (paise: number) => { const r = paise / 100; return r >= 1e7 ? `₹${(r / 1e7).toFixed(1)}Cr` : r >= 1e5 ? `₹${(r / 1e5).toFixed(1)}L` : r >= 1e3 ? `₹${(r / 1e3).toFixed(1)}k` : `₹${Math.round(r)}`; };
const STATUS_TONE: Record<string, string> = { PENDING_PAYMENT: "bg-amber-100 text-amber-800", PLACED: "bg-sky-100 text-sky-800", CONFIRMED: "bg-sky-100 text-sky-800", PROCESSING: "bg-indigo-100 text-indigo-800", SHIPPED: "bg-violet-100 text-violet-800", DELIVERED: "bg-emerald-100 text-emerald-800", CANCELLED: "bg-red-100 text-red-800" };
const pill = (s: string) => `inline-block rounded-sm px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[s] ?? "bg-soft text-muted"}`;

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-muted">{now ? "New" : "–"}</span>;
  const p = ((now - before) / before) * 100;
  return <span className={`text-xs font-semibold ${p >= 0 ? "text-success" : "text-brand"}`}>{p >= 0 ? "▲" : "▼"} {Math.abs(p).toFixed(0)}% <span className="font-normal text-muted">vs previous</span></span>;
}

function Kpi({ label, value, children, accent }: { label: string; value: string; children?: React.ReactNode; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-card">
      <span aria-hidden className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 min-h-4">{children}</div>
    </div>
  );
}

function RevenueChart({ series }: { series: Stats["series"] }) {
  const W = 720, H = 220, P = { l: 44, r: 12, t: 12, b: 26 };
  const max = Math.max(1, ...series.map((s) => s.revenuePaise));
  const nice = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / nice) * nice;
  const x = (i: number) => P.l + (series.length < 2 ? 0 : (i / (series.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
  const line = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(s.revenuePaise).toFixed(1)}`).join(" ");
  const [hover, setHover] = useState<number | null>(null);
  const h = hover === null ? null : series[hover];
  const ticks = [0, 0.5, 1].map((t) => t * top);
  const labelEvery = Math.ceil(series.length / 6);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Revenue per day, peak ${compact(max)}`} className="w-full"
        onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(series.length - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (series.length - 1))))); }}>
        
        {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e4e4e4" strokeDasharray={t ? "3 4" : undefined} /><text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#56696f">{compact(t)}</text></g>)}
        <path d={`${line} L${x(series.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="#c4301c" fillOpacity=".08" />
        <path d={line} fill="none" stroke="#c4301c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => i % labelEvery === 0 && <text key={s.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#56696f">{new Date(s.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</text>)}
        {hover !== null && h && <g><line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="#072835" strokeOpacity=".25" /><circle cx={x(hover)} cy={y(h.revenuePaise)} r="5" fill="#c4301c" stroke="#fff" strokeWidth="2" /></g>}
      </svg>
      {h && <div className="pointer-events-none absolute right-2 top-0 rounded-lg bg-navy px-3 py-2 text-xs text-white shadow-md"><b>{new Date(h.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</b><br />{formatPaise(h.revenuePaise)} · {h.orders} order{h.orders === 1 ? "" : "s"}</div>}
    </div>
  );
}

const Panel = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="rounded-2xl bg-white p-5 shadow-card"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg">{title}</h2>{action}</div>{children}</section>
);

export default function Dashboard() {
  const me = useMe();
  const [range, setRange] = useState<Range>("30d");
  const [s, setS] = useState<Stats | null>(null);
  const [low, setLow] = useState<Low[]>([]);
  const [counts, setCounts] = useState<{ ACTIVE?: number; DRAFT?: number }>({});
  const canOrders = can(me, "order:read");

  useEffect(() => { if (canOrders) get<Stats>(`/admin/stats/overview?range=${range}`).then(setS).catch(() => setS(null)); }, [range, canOrders]);
  useEffect(() => {
    if (can(me, "inventory:read")) get<Low[]>("/admin/inventory/low-stock?limit=6").then(setLow).catch(() => undefined);
    if (can(me, "product:read")) for (const st of ["ACTIVE", "DRAFT"] as const) get<{ total: number }>(`/admin/products?status=${st}&limit=1`).then((r) => setCounts((c) => ({ ...c, [st]: r.total }))).catch(() => undefined);
  }, [me]);

  const catTotal = useMemo(() => s?.categories.reduce((a, c) => a + c.revenuePaise, 0) ?? 0, [s]);
  const hour = new Date().getHours();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm text-muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p><h1 className="text-3xl">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {me.name}</h1></div>
        {canOrders && <div role="tablist" aria-label="Date range" className="inline-flex rounded-full bg-white p-1 shadow-card">{(["7d", "30d", "90d"] as Range[]).map((r) => <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={`min-h-9 rounded-sm px-4 text-sm font-semibold transition ${range === r ? "bg-navy text-white" : "text-muted hover:text-ink"}`}>{r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}</button>)}</div>}
      </div>

      {canOrders && (s ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Revenue" value={formatPaise(s.revenuePaise)} accent="bg-brand"><Delta now={s.revenuePaise} before={s.prevRevenuePaise} /></Kpi>
            <Kpi label="Orders" value={String(s.orders)} accent="bg-navy"><Delta now={s.orders} before={s.prevOrders} /></Kpi>
            <Kpi label="Average order value" value={formatPaise(s.aovPaise)} accent="bg-gold"><span className="text-xs text-muted">per paid or COD order</span></Kpi>
            <Kpi label="New customers" value={String(s.newCustomers)} accent="bg-success"><span className="text-xs text-muted">signed up this period</span></Kpi>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2"><Panel title="Revenue"><RevenueChart series={s.series} /></Panel></div>
            <Panel title="Orders by status">
              {s.byStatus.length === 0 ? <p className="text-sm text-muted">No orders in this period.</p> : (
                <ul className="space-y-3">{s.byStatus.map((b) => <li key={b.status}><div className="mb-1 flex justify-between text-sm"><span className={pill(b.status)}>{b.status.replace("_", " ")}</span><b>{b.count}</b></div><div className="h-1.5 rounded-full bg-soft"><div className="h-full rounded-full bg-navy" style={{ width: `${(b.count / Math.max(...s.byStatus.map((x) => x.count))) * 100}%` }} /></div></li>)}</ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top products">
              {s.topProducts.length === 0 ? <p className="text-sm text-muted">No sales yet in this period.</p> : (
                <ol className="divide-y divide-line text-sm">{s.topProducts.map((p, i) => <li key={p.title} className="flex items-center gap-3 py-2.5"><span className="grid size-7 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span><span className="flex-1 font-semibold">{p.title}</span><span className="text-muted">{p.qty} sold</span><b className="w-24 text-right">{formatPaise(p.revenuePaise)}</b></li>)}</ol>
              )}
            </Panel>
            <Panel title="Sales by category">
              {s.categories.length === 0 ? <p className="text-sm text-muted">No sales yet in this period.</p> : (
                <ul className="space-y-3">{s.categories.map((c) => <li key={c.name}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{c.name}</span><span className="text-muted">{formatPaise(c.revenuePaise)} · {Math.round((c.revenuePaise / catTotal) * 100)}%</span></div><div className="h-2 rounded-full bg-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${(c.revenuePaise / catTotal) * 100}%` }} /></div></li>)}</ul>
              )}
            </Panel>
          </div>

          <Panel title="Recent orders" action={<Link href="/orders" className="text-sm font-semibold underline">View all</Link>}>
            {s.recent.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-muted"><tr><th className="pb-2 font-medium">Order</th><th className="font-medium">Status</th><th className="font-medium">City</th><th className="font-medium">When</th><th className="text-right font-medium">Total</th></tr></thead>
                <tbody>{s.recent.map((o) => <tr key={o.id} className="border-t border-line"><td className="py-2.5"><Link href={`/orders/${o.id}`} className="font-semibold hover:underline">{o.orderNumber}</Link></td><td><span className={pill(o.status)}>{o.status.replace("_", " ")}</span></td><td>{o.city ?? "–"}</td><td className="text-muted">{new Date(o.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td><td className="text-right font-semibold">{formatPaise(o.totalPaise)}</td></tr>)}</tbody></table></div>
            )}
          </Panel>
        </>
      ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}</div>)}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Catalog">
          <dl className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-soft p-3"><dt className="text-muted">Live products</dt><dd className="text-2xl font-semibold">{counts.ACTIVE ?? "–"}</dd></div><div className="rounded-xl bg-soft p-3"><dt className="text-muted">Drafts</dt><dd className="text-2xl font-semibold">{counts.DRAFT ?? "–"}</dd></div></dl>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">{can(me, "product:write") && <Link href="/products/new" className="rounded-sm bg-navy px-4 py-2 text-white">New product</Link>}<Link href="/products" className="rounded-sm border border-line px-4 py-2">All products</Link></div>
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="Needs restocking" action={<Link href="/inventory" className="text-sm font-semibold underline">Manage inventory</Link>}>
            {low.length === 0 ? <p className="text-sm text-muted">Everything is well stocked.</p> : (
              <ul className="divide-y divide-line text-sm">{low.map((l) => { const a = l.onHand - l.reserved; return <li key={l.variantId} className="flex items-center justify-between py-2.5"><span><b>{l.title}</b> <span className="text-muted">({l.sku})</span></span><span className={`rounded-sm px-2.5 py-0.5 text-xs font-semibold ${a <= 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{a <= 0 ? "Out of stock" : `${a} left`}</span></li>; })}</ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
