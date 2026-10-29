"use client";
import { Button } from "@app/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API } from "@/lib/api";

const inputCls = "min-h-11 w-full rounded-lg border border-line bg-white px-3 focus-visible:outline-2 focus-visible:outline-brand";

export default function Track() {
  const router = useRouter();
  const [orderNumber, setN] = useState("");
  const [phone, setP] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await fetch(`${API}/orders/track`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber, phone }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (r?.ok) router.push(`/order/${j.publicId}`);
    else setError(j?.errors?.[0]?.message ?? j?.title ?? "Couldn't look that up, please try again");
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <h1 className="text-3xl">Track your order</h1>
      <form onSubmit={submit} className="space-y-4" aria-label="Track order">
        <label className="block space-y-1 text-sm"><span className="font-semibold">Order number</span><input className={inputCls} value={orderNumber} onChange={(e) => setN(e.target.value)} placeholder="ORD-100001" required /></label>
        <label className="block space-y-1 text-sm"><span className="font-semibold">Mobile number</span><input className={inputCls} value={phone} onChange={(e) => setP(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" required /></label>
        {error && <p role="alert" className="text-sm font-semibold text-brand">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Looking…" : "Track order"}</Button>
      </form>
    </main>
  );
}
