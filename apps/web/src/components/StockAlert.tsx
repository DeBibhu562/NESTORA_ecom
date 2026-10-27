"use client";
import { Button } from "@app/ui";
import { useState, type FormEvent } from "react";
import { API } from "@/lib/api";

export function StockAlert({ variantId }: { variantId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy"); setError("");
    try {
      const res = await fetch(`${API}/catalog/stock-alerts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantId, contact: new FormData(e.currentTarget).get("contact") }) });
      if (res.ok) return setState("done");
      const b = await res.json().catch(() => null);
      setError(b?.errors?.[0]?.message ?? b?.title ?? "Something went wrong");
    } catch { setError("Network error, please try again"); }
    setState("idle");
  }

  if (state === "done") return <p role="status" className="rounded-xl bg-soft p-3 text-sm text-success">Thanks! We'll let you know when it's back.</p>;
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl bg-soft p-3" key={variantId}>
      <label className="block text-sm font-semibold" htmlFor="notify-contact">Notify me when available</label>
      <div className="flex gap-2">
        <input id="notify-contact" name="contact" required placeholder="Mobile number or email" autoComplete="email" className="min-h-11 flex-1 rounded-lg border border-line bg-white px-3 text-sm" aria-describedby={error ? "notify-error" : undefined} />
        <Button type="submit" disabled={state === "busy"}>{state === "busy" ? "Saving…" : "Notify me"}</Button>
      </div>
      {error && <p id="notify-error" role="alert" className="text-xs text-brand">{error}</p>}
    </form>
  );
}
