"use client";
import { Button, formatPaise } from "@app/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { account, useAuth } from "@/lib/auth";

type Row = { orderNumber: string; publicId: string; status: string; totalPaise: number; createdAt: string; items: { title: string; qty: number }[] };
const inputCls = "min-h-11 w-full rounded-lg border border-line bg-white px-3 focus-visible:outline-2 focus-visible:outline-brand";

export default function Account() {
  const router = useRouter();
  const { user, ready, reload, logout } = useAuth();
  const [orders, setOrders] = useState<Row[] | null>(null);
  const [name, setName] = useState("");
  const [pw, setPw] = useState({ current: "", password: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { if (ready && !user) router.replace("/login?next=/account"); }, [ready, user, router]);
  useEffect(() => { if (user) { setName(user.name ?? ""); void account<Row[]>("GET", "/orders").then((r) => setOrders(r.data ?? [])); } }, [user]);
  if (!user) return <main className="mx-auto max-w-2xl p-8"><div className="h-40 animate-pulse rounded-xl bg-soft" /></main>;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const r = await account("PATCH", "/me", { name });
    setMsg(r.ok ? "Saved" : r.error); if (r.ok) await reload();
  }
  async function savePw(e: FormEvent) {
    e.preventDefault();
    const r = await account("PUT", "/password", { password: pw.password, ...(pw.current && { current: pw.current }) });
    setMsg(r.ok ? "Password updated" : r.error); if (r.ok) setPw({ current: "", password: "" });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-3xl">Hi, {user.name ?? "there"}</h1><p className="text-sm text-muted">{user.email}</p></div>
        <Button variant="ghost" onClick={async () => { await logout(); router.push("/"); }}>Sign out</Button>
      </div>
      {msg && <p role="status" className="rounded-lg bg-soft p-3 text-sm">{msg}</p>}

      <section aria-label="Orders"><h2 className="mb-2 text-xl">Your orders</h2>
        {orders === null ? <div className="h-16 animate-pulse rounded-xl bg-soft" /> : orders.length === 0 ? <p className="text-sm text-muted">No orders yet. <Link href="/" className="underline">Start shopping</Link></p> : (
          <ul className="space-y-2">{orders.map((o) => (
            <li key={o.publicId} className="rounded-xl border border-line p-3 text-sm">
              <Link href={`/order/${o.publicId}`} className="font-semibold underline">{o.orderNumber}</Link> · {o.status.replace("_", " ").toLowerCase()} · {formatPaise(o.totalPaise)}
              <p className="text-muted">{o.items.map((i) => `${i.title} × ${i.qty}`).join(", ")} · {new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
            </li>))}</ul>
        )}
      </section>

      <form onSubmit={saveName} className="space-y-3" aria-label="Profile"><h2 className="text-xl">Profile</h2>
        <label className="block space-y-1 text-sm"><span className="font-semibold">Name</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
        <Button type="submit" variant="secondary">Save</Button>
      </form>

      <form onSubmit={savePw} className="space-y-3" aria-label="Password"><h2 className="text-xl">{user.hasPassword ? "Change password" : "Set a password"}</h2>
        {user.hasPassword && <label className="block space-y-1 text-sm"><span className="font-semibold">Current password</span><input className={inputCls} type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required /></label>}
        <label className="block space-y-1 text-sm"><span className="font-semibold">New password</span><input className={inputCls} type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} autoComplete="new-password" minLength={8} required /></label>
        <Button type="submit" variant="secondary">Update password</Button>
      </form>
    </main>
  );
}
