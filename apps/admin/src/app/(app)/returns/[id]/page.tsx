"use client";
import { Button, formatPaise } from "@app/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, Field, Input, Problems } from "@/components/form";
import { useFeedback } from "@/components/feedback";
import { get, post } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Ret = {
  id: string; returnNumber: string; status: string; reason: string; details: string | null; photos: string[]; refundPaise: number | null; refundMethod: string | null; refundDetails: string | null; rejectReason: string | null; pickupAwb: string | null; createdAt: string;
  items: { orderItemId: string; qty: number }[];
  events: { id: string; type: string; message: string | null; actor: string | null; createdAt: string }[];
  order: { id: string; orderNumber: string; items: { id: string; title: string; variantTitle: string; engraving: string | null; qty: number }[] };
};
const words = (s: string) => s.replace(/_/g, " ").toLowerCase();

export default function ReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const canWrite = can(me, "return:write");
  const canRefund = can(me, "order:refund");
  const { toast, confirm } = useFeedback();
  const [r, setR] = useState<Ret | null>(null);
  const [error, setError] = useState<unknown>();
  const [awb, setAwb] = useState("");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState<Record<string, boolean>>({});

  const load = useCallback(() => get<Ret>(`/admin/returns/${id}`).then((x) => { setR(x); setError(undefined); }).catch(setError), [id]);
  useEffect(() => { void load(); }, [load]);
  const act = async (path: string, body: unknown, ok: string) => { try { await post(`/admin/returns/${id}/${path}`, body); toast(ok); void load(); } catch (e) { setError(e); } };

  if (!r) return <div className="space-y-4"><Problems error={error} /><div className="h-40 animate-pulse rounded-xl bg-soft" /></div>;
  const line = (itemId: string) => r.order.items.find((i) => i.id === itemId);
  const open = ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "RECEIVED"].includes(r.status);

  return (
    <div className="space-y-6">
      <p><Link href="/returns" className="text-sm underline">← All returns</Link></p>
      <div><h1 className="text-3xl">{r.returnNumber}</h1><p className="text-sm capitalize text-muted">{words(r.status)} · order <Link href={`/orders/${r.order.id}`} className="underline">{r.order.orderNumber}</Link></p></div>
      <Problems error={error} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="What the customer says">
          <p className="text-sm"><b className="capitalize">{words(r.reason)}</b>{r.details && <> — {r.details}</>}</p>
          <ul className="text-sm">{r.items.map((i) => <li key={i.orderItemId}>{i.qty} × {line(i.orderItemId)?.title} <span className="text-muted">{line(i.orderItemId)?.variantTitle}</span>{line(i.orderItemId)?.engraving && " ✎ engraved"}</li>)}</ul>
          {r.photos.length > 0 && <div className="flex flex-wrap gap-2">{r.photos.map((p) => <a key={p} href={p} target="_blank" rel="noopener noreferrer"><img src={p} alt="Customer photo" className="size-24 object-cover" /></a>)}</div>}
        </Card>
        <Card title="Refund">
          <p className="text-2xl font-bold">{r.refundPaise ? formatPaise(r.refundPaise) : "–"}</p>
          <p className="text-sm text-muted">{r.refundMethod === "ORIGINAL" ? "Back to the original payment method" : `Pay out by ${r.refundMethod}: `}{r.refundMethod !== "ORIGINAL" && <b className="text-ink">{r.refundDetails}</b>}</p>
        </Card>
      </div>

      {canWrite && open && (
        <Card title="Next step">
          {r.status === "REQUESTED" && (
            <div className="flex flex-wrap items-end gap-3">
              <Button onClick={() => act("approve", {}, "Return approved")}>Approve return</Button>
              <Field label="Or reject, with a reason the customer will see"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <Button variant="secondary" disabled={reason.trim().length < 3} onClick={() => act("reject", { reason }, "Return rejected")}>Reject</Button>
            </div>
          )}
          {r.status === "APPROVED" && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Pickup AWB (after you book the reverse pickup)"><Input value={awb} onChange={(e) => setAwb(e.target.value)} /></Field>
              <Button disabled={awb.trim().length < 3} onClick={() => act("pickup", { awb }, "Pickup recorded")}>Pickup booked</Button>
            </div>
          )}
          {["APPROVED", "PICKUP_SCHEDULED"].includes(r.status) && (
            <div className="space-y-3 border-t border-line pt-3">
              <p className="text-sm font-semibold">Parcel arrived? Check the items, then choose what happens to each.</p>
              {r.items.map((i) => <label key={i.orderItemId} className="flex items-center gap-3 text-sm"><select value={restock[i.orderItemId] === undefined ? "" : restock[i.orderItemId] ? "yes" : "no"} onChange={(e) => setRestock({ ...restock, [i.orderItemId]: e.target.value === "yes" })} className="min-h-10 rounded-sm border border-line px-2"><option value="">Choose…</option><option value="yes">Put back in stock</option><option value="no">Write off (damaged)</option></select>{i.qty} × {line(i.orderItemId)?.title}</label>)}
              <Button disabled={r.items.some((i) => restock[i.orderItemId] === undefined)} onClick={() => act("receive", { items: r.items.map((i) => ({ orderItemId: i.orderItemId, restock: !!restock[i.orderItemId] })) }, "Marked as received")}>Mark received</Button>
            </div>
          )}
          {r.status === "RECEIVED" && canRefund && (
            <Button onClick={async () => { if (await confirm({ title: `Refund ${formatPaise(r.refundPaise ?? 0)}?`, body: r.refundMethod === "ORIGINAL" ? "The money goes back to the customer's original payment method." : "This adds the refund to the payout list. You pay the customer yourself and enter the reference.", confirmLabel: "Refund" })) void act("refund", {}, "Refund started"); }}>Refund {formatPaise(r.refundPaise ?? 0)}</Button>
          )}
          {r.status === "RECEIVED" && !canRefund && <p className="text-sm text-muted">Only staff with refund permission can issue the refund.</p>}
        </Card>
      )}
      {r.rejectReason && <p className="rounded-xl bg-white p-4 text-sm shadow-card">Rejected: {r.rejectReason}</p>}
      <Card title="Timeline"><ol className="space-y-1 text-sm">{r.events.map((e) => <li key={e.id}><span className="font-semibold">{e.message ?? e.type}</span> <span className="text-muted">{new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{e.actor && ` · ${e.actor}`}</span></li>)}</ol></Card>
    </div>
  );
}
