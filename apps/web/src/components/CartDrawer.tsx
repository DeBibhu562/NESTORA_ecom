"use client";
import { Button, Stepper, formatPaise } from "@app/ui";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCart } from "@/lib/cart";
import { PincodeCheck } from "./PincodeCheck";

/** Native <dialog>: showModal() gives us the focus trap, Escape-to-close and inert background for free. */
export function CartDrawer() {
  const { cart, open, setOpen, busy, error, setQty, applyCoupon } = useCart();
  const ref = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function coupon(e: FormEvent) {
    e.preventDefault();
    if (code.trim() && (await applyCoupon(code.trim()))) setCode("");
  }

  const items = cart?.items ?? [];
  const m = cart?.milestones;
  const target = m?.next ? m.next.thresholdPaise : null;
  const pct = target && cart ? Math.min(100, Math.round(((cart.subtotalPaise - cart.couponDiscountPaise) / target) * 100)) : 100;

  return (
    <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)} aria-labelledby="cart-title"
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md p-0 backdrop:bg-black/40">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 id="cart-title" className="text-xl">Your cart</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close cart" className="grid size-11 place-items-center rounded-full hover:bg-soft">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="grid flex-1 place-content-center gap-4 p-8 text-center">
            <p className="text-muted">Your cart is empty.</p>
            <Button onClick={() => setOpen(false)}>Continue shopping</Button>
          </div>
        ) : (
          <>
            {m && (
              <div className="border-b border-line p-4 text-sm">
                <p>{m.next ? <>Add <strong>{formatPaise(m.next.remainingPaise)}</strong> more to unlock <strong>{m.next.label}</strong></> : "You've unlocked every reward 🎉"}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next reward"><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
                {m.reached.length > 0 && <p className="mt-2 text-xs text-success">Unlocked: {m.reached.map((r) => r.label).join(", ")}</p>}
              </div>
            )}
            <ul className="flex-1 space-y-4 overflow-y-auto p-4">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3">
                  {i.image && <Image src={i.image.url} alt={i.image.alt} width={72} height={72} className="size-[72px] shrink-0 rounded-lg object-cover" unoptimized />}
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${i.slug}?variant=${encodeURIComponent(i.sku)}`} onClick={() => setOpen(false)} className="line-clamp-2 text-sm font-semibold">{i.title}</Link>
                    <p className="text-xs text-muted">{i.sku}{i.engraving && <> · ✎ “{i.engraving}”</>}</p>
                    {!i.inStock && <p role="alert" className="text-xs font-semibold text-brand">{i.available > 0 ? `Only ${i.available} left` : "Out of stock"}, update before checkout</p>}
                    <div className="mt-1 flex items-center justify-between">
                      <Stepper value={i.qty} onChange={(q) => setQty(i.id, q)} min={1} max={Math.max(1, Math.min(10, i.available))} />
                      <span className="font-semibold">{formatPaise(i.linePaise)}</span>
                    </div>
                    <button type="button" onClick={() => setQty(i.id, 0)} className="mt-1 text-xs text-muted underline">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
            {cart && cart.upsells.length > 0 && (
              <div className="border-t border-line p-4">
                <h3 className="mb-2 text-sm font-semibold">Add more</h3>
                <ul className="flex gap-3 overflow-x-auto">
                  {cart.upsells.map((u) => (
                    <li key={u.slug} className="w-28 shrink-0 text-xs">
                      <Link href={`/p/${u.slug}`} onClick={() => setOpen(false)}>
                        {u.image && <Image src={u.image.url} alt={u.image.alt} width={112} height={112} className="size-28 rounded-lg object-cover" unoptimized />}
                        <span className="mt-1 line-clamp-2 block font-semibold">{u.title}</span>
                        <span className="text-muted">from {formatPaise(u.fromPaise)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-3 border-t border-line p-4 text-sm">
              <PincodeCheck />
              <form onSubmit={coupon} className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Coupon code" aria-label="Coupon code" className="min-h-11 flex-1 rounded-lg border border-line px-3 uppercase" />
                <Button type="submit" variant="secondary" disabled={busy}>Apply</Button>
              </form>
              {cart?.coupon && (
                <p className="flex justify-between text-success">
                  <span>{cart.coupon.code} {cart.coupon.applied ? "applied" : "(minimum not met)"} <button type="button" className="underline" onClick={() => applyCoupon(null)}>remove</button></span>
                  <span>−{formatPaise(cart.couponDiscountPaise)}</span>
                </p>
              )}
              {error && <p role="alert" className="text-xs text-brand">{error}</p>}
              <p className="flex justify-between"><span>Subtotal</span><span>{formatPaise(cart!.subtotalPaise)}</span></p>
              {cart!.rewardDiscountPaise > 0 && <p className="flex justify-between text-success"><span>Reward</span><span>−{formatPaise(cart!.rewardDiscountPaise)}</span></p>}
              <p className="flex justify-between"><span>Shipping</span><span>{cart!.shippingPaise ? formatPaise(cart!.shippingPaise) : "Free"}</span></p>
              <p className="flex justify-between text-base font-bold"><span>Total <span className="text-xs font-normal text-muted">(incl. taxes)</span></span><span>{formatPaise(cart!.totalPaise)}</span></p>
              {items.some((i) => !i.inStock)
                ? <Button disabled className="w-full">Checkout</Button>
                : <Link href="/checkout" onClick={() => setOpen(false)} className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-navy px-6 text-sm font-semibold text-white hover:bg-navy/90">Checkout</Link>}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
