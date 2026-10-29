"use client";
import { Button } from "@app/ui";
import { useState, type FormEvent } from "react";
import { API } from "@/lib/api";

type Result = { city: string; state: string; codAllowed: boolean; etaFrom: string; etaTo: string };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function PincodeCheck() {
  const [pin, setPin] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check(e: FormEvent) {
    e.preventDefault();
    setRes(null); setError("");
    if (!/^[1-9]\d{5}$/.test(pin)) return setError("Enter a 6-digit pincode");
    setBusy(true);
    try {
      const r = await fetch(`${API}/catalog/pincode/${pin}`);
      const j = await r.json().catch(() => null);
      if (r.ok) setRes(j); else setError(j?.title ?? "Couldn't check this pincode");
    } catch { setError("Network error, please try again"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={check} className="space-y-2" aria-label="Check delivery">
      <label htmlFor="pincode" className="text-sm font-semibold">Check delivery</label>
      <div className="flex gap-2">
        <input id="pincode" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="postal-code" placeholder="Enter pincode" className="min-h-11 w-40 rounded-lg border border-line px-3" />
        <Button type="submit" variant="secondary" disabled={busy}>{busy ? "Checking…" : "Check"}</Button>
      </div>
      <div role="status" className="text-sm">
        {res && <p className="text-success">Delivers to {res.city}, {res.state} by {day(res.etaFrom)} – {day(res.etaTo)}. {res.codAllowed ? "Cash on delivery available." : "Prepaid only."}</p>}
        {error && <p className="text-brand">{error}</p>}
      </div>
    </form>
  );
}
