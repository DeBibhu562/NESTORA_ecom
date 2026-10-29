"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API } from "./api";

export type CartItem = {
  id: string; variantId: string; sku: string; title: string; slug: string; image: { url: string; alt: string } | null;
  qty: number; engraving: string; isGift: boolean; unitPaise: number; mrpPaise: number; linePaise: number; inStock: boolean; available: number;
};
export type CartView = {
  items: CartItem[]; coupon: { code: string; applied: boolean } | null;
  subtotalPaise: number; couponDiscountPaise: number; rewardDiscountPaise: number;
  upsells: { slug: string; title: string; image: { url: string; alt: string } | null; fromPaise: number }[]; shippingPaise: number; taxPaise: number; totalPaise: number;
  milestones: { reached: { id: string; label: string; type: string }[]; next: { id: string; label: string; thresholdPaise: number; remainingPaise: number } | null };
};
type Ctx = {
  cart: CartView | null; count: number; open: boolean; busy: boolean; error: string;
  setOpen: (o: boolean) => void;
  add: (variantId: string, qty: number, engraving?: string) => Promise<boolean>;
  setQty: (itemId: string, qty: number) => Promise<void>;
  applyCoupon: (code: string | null) => Promise<boolean>;
  refresh: () => Promise<boolean>;
};

const CartCtx = createContext<Ctx | null>(null);
export const useCart = () => { const c = useContext(CartCtx); if (!c) throw new Error("useCart outside CartProvider"); return c; };

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // The server owns the cart (httpOnly cookie) and re-prices on every call; the client only renders what it returns.
  const call = useCallback(async (method: string, path: string, body?: unknown) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API}${path}`, { method, credentials: "include", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.errors?.[0]?.message ?? json?.title ?? "Something went wrong"); return false; }
      setCart(json); return true;
    } catch { setError("Network error, please try again"); return false; }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void call("GET", "/cart"); }, [call]);

  const value = useMemo<Ctx>(() => ({
    cart, open, busy, error, setOpen,
    count: cart?.items.reduce((n, i) => n + i.qty, 0) ?? 0,
    add: async (variantId, qty, engraving = "") => { const ok = await call("POST", "/cart/items", { variantId, qty, engraving }); if (ok) setOpen(true); return ok; },
    setQty: async (id, qty) => { await call("PATCH", `/cart/items/${id}`, { qty }); },
    applyCoupon: (code) => call("PUT", "/cart/coupon", { code }),
    refresh: () => call("GET", "/cart"),
  }), [cart, open, busy, error, call]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
