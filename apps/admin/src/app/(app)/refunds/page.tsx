"use client";
import { formatPaise } from "@app/ui";
import { useCallback, useEffect, useState } from "react";
import { Card, Input, Problems } from "@/components/form";
import { useFeedback } from "@/components/feedback";
import { get, post } from "@/lib/api";

type Payout = { id: string; amountPaise: number; createdAt: string; orderNumber: string; returnNumber: string | null; method: string; details: string | null; name: string | null };

/** Cash-on-delivery refunds: you pay the customer outside the system (UPI or bank transfer), then record the reference here. */
export default function Refunds() {
  const { toast } = useFeedback();
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [utr, setUtr] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>();
  const load = useCallback(() => get<Payout[]>("/admin/refunds/payouts").then((r) => { setRows(r); setError(undefined); }).catch(setError), []);
  useEffect(() => { void load(); }, [load]);
  const paid = async (id: string) => { try { await post(`/admin/refunds/${id}/paid`, { utr: utr[id] }); toast("Marked as paid. The customer has been told."); void load(); } catch (e) { setError(e); } };
  return (
    <div className="space-y-4">
      <div><h1 className="text-3xl">Refunds to pay</h1><p className="text-sm text-muted">Pay each customer, then enter the transaction reference to close it.</p></div>
      <Problems error={error} />
      {rows?.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-muted shadow-card">Nothing waiting. 🎉</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows?.map((p) => (
          <Card key={p.id} title={`${formatPaise(p.amountPaise)} to ${p.name ?? "customer"}`}>
            <p className="text-sm"><b>{p.method}</b>: <span className="font-mono">{p.details}</span></p>
            <p className="text-xs text-muted">{p.returnNumber ?? "Refund"} · order {p.orderNumber} · requested {new Date(p.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
            <div className="flex gap-2"><Input placeholder="UTR / reference" value={utr[p.id] ?? ""} onChange={(e) => setUtr({ ...utr, [p.id]: e.target.value })} /><button disabled={(utr[p.id] ?? "").trim().length < 4} onClick={() => paid(p.id)} className="min-h-11 whitespace-nowrap rounded-sm bg-navy px-4 text-sm font-semibold text-white disabled:opacity-40">Mark paid</button></div>
          </Card>
        ))}
      </div>
    </div>
  );
}
