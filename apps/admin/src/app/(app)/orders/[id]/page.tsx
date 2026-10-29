"use client";
import { Button, formatPaise } from "@app/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, Field, Input, Problems, Textarea } from "@/components/form";
import { useFeedback } from "@/components/feedback";
import { get, post } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Order = {
  id: string; orderNumber: string; status: string; phone: string; email: string | null; totalPaise: number; subtotalPaise: number; discountPaise: number; shippingPaise: number; taxPaise: number;
  shippingAddress: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string }; cancelReason: string | null; couponCodes: string[]; invoiceNumber: string | null; deliveredAt: string | null; internalNote: string | null;
  items: { id: string; sku: string; title: string; variantTitle: string; qty: number; totalPaise: number; engraving: string | null }[];
  payments: { id: string; method: string; status: string; amountPaise: number; refunds: { status: string; amountPaise: number; method: string; utr: string | null }[] }[];
  shipments: { id: string; courier: string | null; awb: string | null; trackingUrl: string | null; labelUrl: string | null; status: string; events: { id: string; status: string; location: string | null; at: string }[] }[];
  events: { id: string; type: string; message: string | null; actor: string | null; createdAt: string }[];
  messages: { id: string; template: string; channel: string; toAddress: string; ok: boolean; createdAt: string }[];
  returns: { id: string; returnNumber: string; status: string; reason: string; refundPaise: number | null; createdAt: string }[];
};
const NEXT: Record<string, { to: string; label: string; hint: string } | undefined> = {
  PLACED: { to: "CONFIRMED", label: "Confirm order", hint: "Customer gets a confirmation message." },
  CONFIRMED: { to: "PROCESSING", label: "Mark packed", hint: "Print the packing slip and pack the items." },
  PROCESSING: { to: "SHIPPED", label: "Ship order", hint: "Stock is deducted and the invoice number is created." },
  SHIPPED: { to: "DELIVERED", label: "Mark delivered", hint: "Normally the courier does this for you. Starts the return window." },
};
const STEPS = ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
const STEP_LABEL: Record<string, string> = { PLACED: "Placed", CONFIRMED: "Confirmed", PROCESSING: "Packed", SHIPPED: "Shipped", DELIVERED: "Delivered" };
const words = (s: string) => s.replace(/_/g, " ").toLowerCase();
const when = (d: string) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const canWrite = can(me, "order:write");
  const { toast, confirm } = useFeedback();
  const [o, setO] = useState<Order | null>(null);
  const [auto, setAuto] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<unknown>();
  const [ship, setShip] = useState({ courier: "", awb: "", trackingUrl: "" });
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => get<Order>(`/admin/orders/${id}`).then((r) => { setO(r); setNote(r.internalNote ?? ""); setError(undefined); }).catch(setError), [id]);
  useEffect(() => { void load(); get<{ auto: boolean }>("/admin/shipping/config").then((c) => setAuto(c.auto)).catch(() => undefined); }, [load]);

  async function advance(to: string) {
    setBusy(true);
    try {
      await post(`/admin/orders/${id}/advance`, { to, ...(to === "SHIPPED" && (!auto || manual) && { courier: ship.courier || undefined, awb: ship.awb || undefined, trackingUrl: ship.trackingUrl || undefined }) });
      toast("Order updated"); void load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function cancel() {
    if (!(await confirm({ title: `Cancel ${o?.orderNumber}?`, body: "Stock is released and any online payment is refunded.", confirmLabel: "Cancel order", danger: true }))) return;
    try { await post(`/admin/orders/${id}/cancel`, { reason }); toast("Order cancelled"); void load(); } catch (e) { setError(e); }
  }
  async function saveNote() { try { await post(`/admin/orders/${id}/note`, { note }); toast("Note saved"); } catch (e) { setError(e); } }
  async function resend(template: string) { try { await post(`/admin/orders/${id}/resend`, { template }); toast("Message sent"); void load(); } catch (e) { setError(e); } }

  if (!o) return <div className="space-y-4"><Problems error={error} /><div className="h-40 animate-pulse rounded-xl bg-soft" /></div>;
  const step = NEXT[o.status];
  const a = o.shippingAddress;
  const reached = STEPS.indexOf(o.status);
  const cancellable = ["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PROCESSING"].includes(o.status);
  const sh = o.shipments[0];

  return (
    <div className="space-y-6">
      <p><Link href="/orders" className="text-sm underline">← All orders</Link></p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl">{o.orderNumber}</h1><p className="text-sm capitalize text-muted">{words(o.status)}{o.invoiceNumber && <> · Invoice {o.invoiceNumber}</>}</p></div>
        <div className="flex gap-2">{o.invoiceNumber && <Link href={`/orders/${o.id}/invoice`} className="inline-flex min-h-11 items-center rounded-sm border border-line bg-white px-4 text-sm font-semibold hover:bg-soft">Invoice</Link>}{sh?.labelUrl && <a href={sh.labelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-sm border border-line bg-white px-4 text-sm font-semibold hover:bg-soft">Shipping label</a>}</div>
      </div>
      <Problems error={error} />

      {reached >= 0 && (
        <ol className="grid grid-cols-5 gap-1 rounded-xl bg-white p-4 shadow-card" aria-label="Progress">
          {STEPS.map((s, i) => <li key={s} className="text-center text-xs"><span className={`mx-auto mb-1 grid size-7 place-items-center rounded-full text-xs font-bold ${i <= reached ? "bg-navy text-white" : "bg-soft text-muted"}`}>{i < reached || o.status === "DELIVERED" ? "✓" : i + 1}</span><span className={i <= reached ? "font-semibold" : "text-muted"}>{STEP_LABEL[s]}</span></li>)}
        </ol>
      )}
      {["CANCELLED", "RETURNED", "CLOSED"].includes(o.status) && <p className="rounded-xl bg-white p-4 text-sm shadow-card">This order is <b>{words(o.status)}</b>{o.cancelReason && <> — {o.cancelReason}</>}.</p>}

      {canWrite && (step || cancellable) && (
        <Card title="Next step">
          {step && <p className="text-sm text-muted">{step.hint}</p>}
          {step?.to === "SHIPPED" && (
            <div className="space-y-3">
              {auto && !manual && <p className="rounded-lg bg-soft p-3 text-sm">Shiprocket will book the courier and generate the AWB and label. <button type="button" className="underline" onClick={() => setManual(true)}>I booked the courier myself</button></p>}
              {(!auto || manual) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Courier"><Input value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} /></Field>
                  <Field label="AWB / tracking number"><Input value={ship.awb} onChange={(e) => setShip({ ...ship, awb: e.target.value })} /></Field>
                  <Field label="Tracking link"><Input type="url" value={ship.trackingUrl} onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} /></Field>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            {step && <Button disabled={busy} onClick={() => advance(step.to)}>{busy ? "Working…" : step.label}</Button>}
            {cancellable && (
              <>
                <Field label="Cancellation reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} /></Field>
                <Button variant="secondary" disabled={reason.trim().length < 3} onClick={cancel}>Cancel order</Button>
              </>
            )}
          </div>
        </Card>
      )}

      <Card title="Items">
        <table className="w-full text-left text-sm"><caption className="sr-only">Items</caption>
          <thead className="text-muted"><tr><th scope="col" className="py-2">Item</th><th scope="col">SKU</th><th scope="col">Qty</th><th scope="col" className="text-right">Total</th></tr></thead>
          <tbody>{o.items.map((i) => <tr key={i.id} className="border-t border-line"><td className="py-2">{i.title}<span className="text-muted"> · {i.variantTitle}</span>{i.engraving && <> · ✎ “{i.engraving}”</>}</td><td className="font-mono">{i.sku}</td><td>{i.qty}</td><td className="text-right">{formatPaise(i.totalPaise)}</td></tr>)}</tbody>
        </table>
        <p className="text-right text-sm">Shipping {o.shippingPaise ? formatPaise(o.shippingPaise) : "free"}{o.discountPaise > 0 && <> · Discounts −{formatPaise(o.discountPaise)}{o.couponCodes.length > 0 && ` (${o.couponCodes.join(", ")})`}</>} · GST incl. {formatPaise(o.taxPaise)}</p>
        <p className="text-right text-lg font-bold">{formatPaise(o.totalPaise)}</p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Customer & delivery"><p className="text-sm">{a.name}<br />{o.phone}{o.email && <> · {o.email}</>}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.pincode}</p></Card>
        <Card title="Payment">
          {o.payments.map((p) => <p key={p.id} className="text-sm">{p.method === "COD" ? "Cash on delivery" : p.method} · {words(p.status)} · {formatPaise(p.amountPaise)}{p.refunds.map((r, k) => <span key={k} className="block text-muted">Refund {formatPaise(r.amountPaise)}: {words(r.status)}{r.utr && ` (ref ${r.utr})`}</span>)}</p>)}
          {o.payments.length === 0 && <p className="text-sm text-muted">No payment started.</p>}
        </Card>
      </div>

      {sh && (
        <Card title="Shipment">
          <p className="text-sm">{sh.courier ?? "Courier"}{sh.awb && <> · AWB <span className="font-mono">{sh.awb}</span></>} · <b className="capitalize">{words(sh.status)}</b>{sh.trackingUrl && <> · <a className="underline" href={sh.trackingUrl} target="_blank" rel="noopener noreferrer">Track</a></>}</p>
          <ol className="space-y-1 border-l-2 border-line pl-4 text-sm">{[...sh.events].reverse().map((e) => <li key={e.id}><span className="font-semibold">{e.status}</span> <span className="text-muted">{e.location && `${e.location} · `}{when(e.at)}</span></li>)}</ol>
        </Card>
      )}

      {o.returns.length > 0 && (
        <Card title="Returns">
          <ul className="divide-y divide-line text-sm">{o.returns.map((r) => <li key={r.id} className="flex items-center justify-between py-2"><Link href={`/returns/${r.id}`} className="font-semibold underline">{r.returnNumber}</Link><span className="capitalize text-muted">{words(r.reason)} · {words(r.status)}</span><span>{r.refundPaise ? formatPaise(r.refundPaise) : "–"}</span></li>)}</ul>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Messages sent to the customer">
          {o.messages.length === 0 ? <p className="text-sm text-muted">Nothing sent yet.</p> : <ul className="space-y-1 text-sm">{o.messages.map((m) => <li key={m.id}><span className="font-semibold capitalize">{words(m.template)}</span> <span className="text-muted">{m.channel === "EMAIL" ? "email" : "WhatsApp"} · {m.ok ? "sent" : <b className="text-brand">failed</b>} · {when(m.createdAt)}</span></li>)}</ul>}
          {canWrite && ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED"].includes(o.status) && <div className="flex flex-wrap gap-2 pt-2">{(o.status === "SHIPPED" ? ["SHIPPED", "OUT_FOR_DELIVERY"] : o.status === "DELIVERED" ? ["DELIVERED"] : ["PLACED", "CONFIRMED"]).map((t) => <button key={t} onClick={() => resend(t)} className="min-h-9 rounded-sm border border-line px-3 text-xs font-semibold hover:bg-soft">Resend “{words(t)}”</button>)}</div>}
        </Card>
        <Card title="Internal note">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={!canWrite} placeholder="Only staff can see this" />
          {canWrite && <Button variant="ghost" onClick={saveNote}>Save note</Button>}
        </Card>
      </div>

      <Card title="Timeline"><ol className="space-y-1 text-sm">{o.events.map((e) => <li key={e.id}><span className="font-semibold">{e.message ?? e.type}</span> <span className="text-muted">{when(e.createdAt)}{e.actor && ` · ${e.actor}`}</span></li>)}</ol></Card>
    </div>
  );
}
