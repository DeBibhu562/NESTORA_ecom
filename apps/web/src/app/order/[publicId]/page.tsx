"use client";
import { Button, formatPaise } from "@app/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API, BRAND } from "@/lib/api";
import { payWithRazorpay } from "@/lib/pay";

type Returns = { eligible: boolean; daysLeft: number | null; windowEnds: string | null; windowDays: number; lines: { returnable: number }[]; returns: { returnNumber: string; status: string; reason: string; refundPaise: number | null; rejectReason: string | null }[] };
type Order = {
  orderNumber: string; publicId: string; status: string; paymentMethod: string; paymentStatus: string | null;
  subtotalPaise: number; discountPaise: number; shippingPaise: number; totalPaise: number;
  shippingAddress: { name: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  retry: { keyId: string | null; orderId: string; amountPaise: number } | null;
  items: { title: string; variantTitle: string; qty: number; totalPaise: number; engraving: string | null }[];
  shipments: { courier: string | null; awb: string | null; trackingUrl: string | null; status: string; events: { status: string; location: string | null; at: string }[] }[];
  deliveredAt: string | null; invoiceNumber: string | null;
  timeline: { type: string; message: string | null; at: string }[];
};
const STEPS: [string, string][] = [["PLACED", "Placed"], ["PROCESSING", "Packed"], ["SHIPPED", "Shipped"], ["DELIVERED", "Delivered"]];
const RANK: Record<string, number> = { PLACED: 0, CONFIRMED: 0, PROCESSING: 1, SHIPPED: 2, PARTIALLY_SHIPPED: 2, DELIVERED: 3, CLOSED: 3, RETURNED: 3 };
const RET_LABEL: Record<string, string> = { REQUESTED: "Under review", APPROVED: "Approved, pickup being arranged", PICKUP_SCHEDULED: "Pickup booked", RECEIVED: "Received, refund being processed", REFUNDED: "Refunded", REJECTED: "Not approved" };
const LABEL: Record<string, string> = { PENDING_PAYMENT: "Awaiting payment", PLACED: "Order placed", CONFIRMED: "Confirmed", PROCESSING: "Being packed", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled" };

export default function OrderPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const [o, setO] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ret, setRet] = useState<Returns | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/orders/${publicId}`).catch(() => null);
    if (!r?.ok) return setError(r?.status === 404 ? "We couldn't find this order." : "Couldn't load your order.");
    setO(await r.json());
    const rr = await fetch(`${API}/orders/${publicId}/returns`).catch(() => null);
    if (rr?.ok) setRet(await rr.json());
  }, [publicId]);
  useEffect(() => { void load(); }, [load]);

  async function pay() {
    if (!o?.retry) return;
    setBusy(true);
    const r = await payWithRazorpay(o.retry, {}, BRAND);
    if (r === "error") setError("Payment could not be completed. Please try again.");
    await load(); setBusy(false);
  }
  async function cancel() {
    if (!confirm("Cancel this order?")) return;
    setBusy(true);
    const r = await fetch(`${API}/orders/${publicId}/cancel`, { method: "POST" });
    if (!r.ok) setError((await r.json().catch(() => null))?.title ?? "Couldn't cancel");
    await load(); setBusy(false);
  }

  if (error && !o) return <main className="mx-auto max-w-2xl p-8 text-center"><p role="alert">{error}</p><Link href="/track" className="mt-3 inline-block underline">Track an order</Link></main>;
  if (!o) return <main className="mx-auto max-w-2xl p-8"><div className="h-40 animate-pulse rounded-xl bg-soft" /></main>;
  const a = o.shippingAddress;
  const thanks = o.status === "PLACED" || o.status === "CONFIRMED";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl">{thanks ? "Thank you! Your order is placed." : LABEL[o.status] ?? o.status}</h1>
        <p className="mt-1 text-muted">Order <strong>{o.orderNumber}</strong> · {LABEL[o.status] ?? o.status} · {o.paymentMethod === "COD" ? "Pay on delivery" : o.paymentStatus === "CAPTURED" ? "Paid online" : "Online payment"}</p>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-brand">{error}</p>}
      {o.status in RANK && (
        <ol className="grid grid-cols-4 gap-1 border-y border-line py-4" aria-label="Order progress">
          {STEPS.map(([k, l], i) => <li key={k} className="text-center text-xs"><span className={`mx-auto mb-1 grid size-7 place-items-center rounded-full text-xs font-bold ${i <= RANK[o.status]! ? "bg-navy text-white" : "bg-soft text-muted"}`}>{i <= RANK[o.status]! ? "✓" : i + 1}</span><span className={i <= RANK[o.status]! ? "font-semibold" : "text-muted"}>{l}</span></li>)}
        </ol>
      )}
      {o.retry && <div className="rounded-xl border border-brand/40 bg-brand/5 p-4"><p className="mb-3 text-sm">Your payment hasn't gone through yet. We're holding your items for a few minutes.</p><Button variant="secondary" disabled={busy} onClick={pay}>Pay {formatPaise(o.totalPaise)}</Button></div>}

      <section aria-label="Items" className="space-y-2 rounded-xl border border-line p-4 text-sm">
        {o.items.map((i, k) => <p key={k} className="flex justify-between gap-2"><span>{i.title}{i.variantTitle && <span className="text-muted"> · {i.variantTitle}</span>} × {i.qty}{i.engraving && <> · ✎ “{i.engraving}”</>}</span><span>{formatPaise(i.totalPaise)}</span></p>)}
        <hr className="border-line" />
        <p className="flex justify-between"><span>Shipping</span><span>{o.shippingPaise ? formatPaise(o.shippingPaise) : "Free"}</span></p>
        {o.discountPaise > 0 && <p className="flex justify-between text-success"><span>Discounts</span><span>−{formatPaise(o.discountPaise)}</span></p>}
        <p className="flex justify-between text-base font-bold"><span>Total</span><span>{formatPaise(o.totalPaise)}</span></p>
      </section>

      <section aria-label="Delivery address" className="rounded-xl border border-line p-4 text-sm">
        <h2 className="mb-1 font-semibold">Delivering to</h2>
        <p>{a.name}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.state} {a.pincode}</p>
      </section>

      {o.shipments.map((s, k) => <section key={k} aria-label="Shipment" className="rounded-xl border border-line p-4 text-sm"><h2 className="mb-1 font-semibold">Shipment</h2><p>{s.courier ?? "Courier"}{s.awb && <> · AWB {s.awb}</>}{s.trackingUrl && <> · <a href={s.trackingUrl} className="underline" rel="noopener noreferrer" target="_blank">Track on courier site</a></>}</p>{s.events.length > 0 && <ol className="mt-2 space-y-1 border-l border-line pl-4">{[...s.events].reverse().map((e, j) => <li key={j}><span className="font-semibold">{e.status}</span> <span className="text-muted">{e.location && `${e.location} · `}{new Date(e.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></li>)}</ol>}</section>)}

      <section aria-label="Timeline"><h2 className="mb-2 font-semibold">Timeline</h2>
        <ol className="space-y-2 border-l border-line pl-4 text-sm">{o.timeline.map((t, k) => <li key={k}><span className="font-semibold">{t.message ?? t.type}</span> <span className="text-muted">{new Date(t.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></li>)}</ol>
      </section>

      {o.invoiceNumber && <p className="text-sm"><Link href={`/order/${o.publicId}/invoice`} className="font-semibold underline">View invoice {o.invoiceNumber}</Link></p>}

      {ret && (ret.returns.length > 0 || ret.eligible) && (
        <section aria-label="Returns" className="space-y-3 border border-line p-4 text-sm">
          <h2 className="font-semibold">Returns</h2>
          {ret.returns.map((r) => <p key={r.returnNumber} className="flex flex-wrap justify-between gap-2"><span><b>{r.returnNumber}</b> · <span className="capitalize">{r.reason.replace(/_/g, " ").toLowerCase()}</span></span><span>{RET_LABEL[r.status] ?? r.status}{r.status === "REJECTED" && r.rejectReason && ` (${r.rejectReason})`}{r.status === "REFUNDED" && r.refundPaise ? ` · ${formatPaise(r.refundPaise)}` : ""}</span></p>)}
          {ret.eligible && ret.lines.some((l) => l.returnable > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-muted">{ret.daysLeft} day{ret.daysLeft === 1 ? "" : "s"} left to return items from this order.</p><Link href={`/order/${o.publicId}/return`} className="inline-flex min-h-11 items-center rounded-sm border border-navy px-5 text-sm font-semibold text-navy hover:bg-navy hover:text-white">Return items</Link></div>
          )}
          {!ret.eligible && o.status === "CLOSED" && <p className="text-muted">The {ret.windowDays}-day return window for this order has ended.</p>}
        </section>
      )}

      {(o.status === "PLACED" || o.status === "PENDING_PAYMENT") && <Button variant="ghost" disabled={busy} onClick={cancel}>Cancel order</Button>}
      <p><Link href="/" className="underline">Continue shopping</Link></p>
    </main>
  );
}
