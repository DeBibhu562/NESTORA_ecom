"use client";
import { useCart } from "@/lib/cart";

export function CartButton() {
  const { count, setOpen } = useCart();
  return (
    <button type="button" onClick={() => setOpen(true)} aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`} className="relative grid size-11 place-items-center rounded-full hover:bg-soft">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6 5 3H2" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></svg>
      {count > 0 && <span aria-hidden className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-sm bg-brand px-1 text-xs font-bold text-white">{count}</span>}
    </button>
  );
}
