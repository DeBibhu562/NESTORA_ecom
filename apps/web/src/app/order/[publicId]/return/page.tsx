"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { API } from "@/lib/api";

type Opts = { eligible: boolean; daysLeft: number | null; cod: boolean; lines: { id: string; title: string; variantTitle: string; imageUrl: string; qty: number; engraved: boolean; returnable: number }[] };
const REASONS: [string, string, boolean][] = [["DAMAGED", "Arrived damaged", true], ["DEFECTIVE", "Not working properly", true], ["WRONG_ITEM", "Received the wrong item", true], ["NOT_AS_DESCRIBED", "Not as described", false], ["CHANGED_MIND", "Changed my mind", false]];
const FAULT = ["DAMAGED", "DEFECTIVE", "WRONG_ITEM"];

export default function ReturnPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const router = useRouter();
  const [o, setO] = useState<Opts | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [method, setMethod] = useState<"UPI" | "BANK">("UPI");
  const [payout, setPayout] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch(`${API}/orders/${publicId}/returns`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setO).catch(() => setError("We couldn't load this order.")); }, [publicId]);

  async function addPhoto(file?: File) {
    if (!file) return;
    const f = new FormData(); f.set("file", file);
    const r = await fetch(`${API}/orders/${publicId}/returns/photos`, { method: "POST", body: f });
    const j = await r.json().catch(() => null);
    if (!r.ok) return setError(j?.title ?? "That photo could not be uploaded");
    setError(""); setPhotos((p) => [...p, j.url]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const items = Object.entries(qty).filter(([, n]) => n > 0).map(([orderItemId, n]) => ({ orderItemId, qty: n }));
    if (!items.length) return setError("Choose the items you want to return.");
    if (!reason) return setError("Tell us why you are returning.");
    if (FAULT.includes(reason) && photos.length === 0) return setError("Please add a photo of the problem.");
    setBusy(true); setError("");
    const r = await fetch(`${API}/orders/${publicId}/returns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, details: details || undefined, items, photos, ...(o?.cod ? { refundMethod: method, refundDetails: payout } : {}) }) });
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return setError(j?.errors?.[0]?.message ?? j?.title ?? "Something went wrong. Please try again.");
    router.push(`/order/${publicId}`);
  }

  if (error && !o) return <main className="mx-auto max-w-xl p-8 text-center"><p role="alert">{error}</p></main>;
  if (!o) return <main className="mx-auto max-w-xl p-8"><div className="h-40 animate-pulse bg-soft" /></main>;
  if (!o.eligible) return <main className="mx-auto max-w-xl space-y-3 p-8"><h1 className="text-3xl">Returns</h1><p>This order can't be returned right now. Returns are open for a limited time after delivery.</p><Link href={`/order/${publicId}`} className="underline">Back to your order</Link></main>;
  const input = "w-full min-h-11 border border-line bg-white px-3 text-sm";

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div><Link href={`/order/${publicId}`} className="text-sm underline">← Back to your order</Link><h1 className="mt-2 text-3xl">Return items</h1><p className="text-sm text-muted">{o.daysLeft} day{o.daysLeft === 1 ? "" : "s"} left. Items must be unused and in their original packaging.</p></div>
      <form onSubmit={submit} className="space-y-6">
        <fieldset className="space-y-3"><legend className="mb-1 font-semibold">1. Which items?</legend>
          {o.lines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border border-line p-3">
              {l.imageUrl && <img src={l.imageUrl} alt="" className="size-14 bg-soft object-cover" />}
              <div className="flex-1 text-sm"><p className="font-semibold">{l.title}</p><p className="text-muted">{l.variantTitle}{l.engraved && " · engraved"}</p>{l.engraved && <p className="text-xs text-muted">Engraved items can only be returned if damaged, defective or wrong.</p>}</div>
              {l.returnable > 0 ? <select aria-label={`Quantity to return for ${l.title}`} value={qty[l.id] ?? 0} onChange={(e) => setQty({ ...qty, [l.id]: Number(e.target.value) })} className="min-h-11 border border-line px-2 text-sm">{Array.from({ length: l.returnable + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? "Keep" : `Return ${n}`}</option>)}</select> : <span className="text-xs text-muted">Already returned</span>}
            </div>
          ))}
        </fieldset>
        <fieldset className="space-y-2"><legend className="mb-1 font-semibold">2. What went wrong?</legend>
          <select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className={input} required><option value="">Choose a reason…</option>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <textarea aria-label="Details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} placeholder="Anything else we should know? (optional)" className={`${input} py-2`} />
          {FAULT.includes(reason) && (
            <div className="space-y-2"><p className="text-sm font-semibold">Add photos of the problem</p>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void addPhoto(e.target.files?.[0])} className="text-sm" disabled={photos.length >= 4} />
              <div className="flex flex-wrap gap-2">{photos.map((p) => <img key={p} src={p} alt="Your photo" className="size-20 object-cover" />)}</div>
            </div>
          )}
        </fieldset>
        {o.cod && (
          <fieldset className="space-y-2"><legend className="mb-1 font-semibold">3. Where should we send your refund?</legend>
            <p className="text-sm text-muted">You paid cash on delivery, so we pay your refund by bank transfer or UPI.</p>
            <div className="flex gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" checked={method === "UPI"} onChange={() => setMethod("UPI")} />UPI id</label><label className="flex items-center gap-2"><input type="radio" checked={method === "BANK"} onChange={() => setMethod("BANK")} />Bank account</label></div>
            <input aria-label="Refund details" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder={method === "UPI" ? "name@bank" : "Account holder, account number, IFSC"} className={input} required />
          </fieldset>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-brand">{error}</p>}
        <button disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-navy px-8 font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Submit return request"}</button>
      </form>
    </main>
  );
}
