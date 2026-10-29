"use client";
import { Button, formatPaise } from "@app/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { API, BRAND } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { payWithRazorpay } from "@/lib/pay";

const inputCls = "min-h-11 w-full rounded-lg border border-line bg-white px-3 focus-visible:outline-2 focus-visible:outline-brand";
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block space-y-1 text-sm"><span className="font-semibold">{label}</span>{children}{hint && <span className="block text-xs text-muted">{hint}</span>}</label>;
}

export default function Checkout() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", email: "", line1: "", line2: "", landmark: "", city: "", pincode: "", pay: "COD" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : ""); // one key per checkout attempt: a double-click or retry can't create two orders

  useEffect(() => { fetch(`${API}/checkout/config`).then((r) => r.json()).then((c) => { setOnline(c.online); if (c.online) setF((x) => ({ ...x, pay: "ONLINE" })); }).catch(() => {}); }, []);
  useEffect(() => { if (user) setF((x) => ({ ...x, name: x.name || user.name || "", email: x.email || user.email })); }, [user]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API}/checkout/orders`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json", "idempotency-key": key.current },
        body: JSON.stringify({ name: f.name, phone: f.phone, email: f.email, paymentMethod: f.pay, address: { line1: f.line1, line2: f.line2 || undefined, landmark: f.landmark || undefined, city: f.city, pincode: f.pincode } }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setError(j?.errors?.[0]?.message ?? j?.title ?? "Couldn't place your order"); return; }
      if (j.retry) await payWithRazorpay(j.retry, { name: f.name, contact: f.phone, email: f.email }, BRAND); // unpaid orders can be paid from the order page
      await refresh();
      router.push(`/order/${j.publicId}`);
    } catch { setError("Network error, please try again"); }
    finally { setBusy(false); }
  }

  if (cart && cart.items.length === 0) return <main className="mx-auto max-w-2xl p-8 text-center"><h1 className="text-3xl">Your cart is empty</h1><Link href="/" className="mt-4 inline-block underline">Continue shopping</Link></main>;
  const unavailable = cart?.items.some((i) => !i.inStock);

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={submit} className="space-y-6" aria-label="Checkout">
        <h1 className="text-3xl">Checkout</h1>
        {!user && <p className="text-sm text-muted">Have an account? <Link href="/login?next=/checkout" className="underline">Sign in</Link> to see this order in your account, or continue as a guest.</p>}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">Contact</legend>
          <Field label="Full name"><input className={inputCls} value={f.name} onChange={set("name")} autoComplete="name" required maxLength={80} /></Field>
          <Field label="Mobile number" hint="We'll send order updates here."><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} required /></Field>
          <div className="sm:col-span-2"><Field label="Email (optional)"><input className={inputCls} type="email" value={f.email} onChange={set("email")} autoComplete="email" /></Field></div>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">Delivery address</legend>
          <div className="sm:col-span-2"><Field label="Address line 1"><input className={inputCls} value={f.line1} onChange={set("line1")} autoComplete="address-line1" required maxLength={120} /></Field></div>
          <div className="sm:col-span-2"><Field label="Address line 2 (optional)"><input className={inputCls} value={f.line2} onChange={set("line2")} autoComplete="address-line2" maxLength={120} /></Field></div>
          <Field label="Landmark (optional)"><input className={inputCls} value={f.landmark} onChange={set("landmark")} maxLength={80} /></Field>
          <Field label="City"><input className={inputCls} value={f.city} onChange={set("city")} autoComplete="address-level2" required maxLength={60} /></Field>
          <Field label="Pincode"><input className={inputCls} value={f.pincode} onChange={set("pincode")} inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} required /></Field>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-lg font-semibold">Payment</legend>
          {online && <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line p-3"><input type="radio" name="pay" value="ONLINE" checked={f.pay === "ONLINE"} onChange={set("pay")} /> UPI, cards, netbanking</label>}
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line p-3"><input type="radio" name="pay" value="COD" checked={f.pay === "COD"} onChange={set("pay")} /> Cash on delivery</label>
        </fieldset>
        {error && <p role="alert" className="text-sm font-semibold text-brand">{error}</p>}
        {unavailable && <p role="alert" className="text-sm font-semibold text-brand">Some items are out of stock. Update your cart to continue.</p>}
        <Button type="submit" variant="secondary" disabled={busy || !cart || unavailable} className="w-full sm:w-auto">{busy ? "Placing order…" : f.pay === "ONLINE" ? "Pay now" : "Place order"}</Button>
      </form>

      <aside className="h-fit space-y-3 rounded-xl border border-line p-4 text-sm" aria-label="Order summary">
        <h2 className="text-lg font-semibold">Summary</h2>
        {cart?.items.map((i) => <p key={i.id} className="flex justify-between gap-2"><span>{i.title} × {i.qty}</span><span>{formatPaise(i.linePaise)}</span></p>)}
        <hr className="border-line" />
        {cart && <>
          <p className="flex justify-between"><span>Subtotal</span><span>{formatPaise(cart.subtotalPaise)}</span></p>
          {cart.couponDiscountPaise > 0 && <p className="flex justify-between text-success"><span>Coupon</span><span>−{formatPaise(cart.couponDiscountPaise)}</span></p>}
          {cart.rewardDiscountPaise > 0 && <p className="flex justify-between text-success"><span>Reward</span><span>−{formatPaise(cart.rewardDiscountPaise)}</span></p>}
          <p className="flex justify-between"><span>Shipping</span><span>{cart.shippingPaise ? formatPaise(cart.shippingPaise) : "Free"}</span></p>
          <p className="flex justify-between text-base font-bold"><span>Total</span><span>{formatPaise(cart.totalPaise)}</span></p>
        </>}
      </aside>
    </main>
  );
}
