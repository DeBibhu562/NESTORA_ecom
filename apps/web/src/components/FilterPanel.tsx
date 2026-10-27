"use client";
import { Button, formatPaise } from "@app/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { Facet } from "@/lib/api";
import { parsePrice, qs, selected, setParam, toggle } from "@/lib/filters";

type Props = { facets: Facet[]; price: { min: number; max: number } | null; total: number; inStockCount: number };

/** All filter state is in the URL; this component only edits it. Mobile: bottom-sheet; desktop: sidebar (single DOM instance). */
export function FilterPanel({ facets, price, total, inStockCount }: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = (next: URLSearchParams) => start(() => router.push(`${path}${qs(next)}`, { scroll: false }));

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);

  const activeCount = [...new Set([...sp.keys()])].filter((k) => !["page", "sort", "q"].includes(k)).length;
  const range = parsePrice(sp.get("price"));
  const applyPrice = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const lo = Number(f.get("min") || 0), hi = Number(f.get("max") || 0);
    go(setParam(sp, "price", lo || hi ? `${lo}-${hi || 999999}` : null));
  };

  return (
    <>
      <Button variant="ghost" className="min-h-11 border border-line lg:hidden" onClick={() => setOpen(true)} aria-haspopup="dialog">Filters{activeCount ? ` (${activeCount})` : ""}</Button>
      <aside aria-label="Filters" aria-busy={pending} className={`${open ? "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white p-4" : "hidden"} lg:static lg:z-auto lg:block lg:overflow-visible lg:bg-transparent lg:p-0`}>
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <h2 className="text-xl">Filters</h2>
          <button ref={closeRef} className="min-h-11 px-2 text-sm underline" onClick={() => setOpen(false)}>Close</button>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-brand" checked={sp.has("in_stock")} onChange={() => go(setParam(sp, "in_stock", sp.has("in_stock") ? null : "1"))} />
          In stock only <span className="font-normal text-muted">({inStockCount})</span>
        </label>

        {facets.map((f) => (
          <fieldset key={f.key} className="mt-4 border-t border-line pt-3">
            <legend className="mb-1 text-sm font-semibold">{f.label}</legend>
            <ul>
              {f.values.map((v) => (
                <li key={v.value}>
                  <label className={`flex min-h-10 cursor-pointer items-center gap-2 text-sm ${v.count === 0 ? "text-muted" : ""}`}>
                    <input type="checkbox" className="size-4 accent-brand" checked={selected(sp, f.key).includes(v.value)} onChange={() => go(toggle(sp, f.key, v.value))} />
                    <span className="flex-1">{v.label}</span><span className="text-xs text-muted">{v.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}

        {price && price.max > price.min && (
          <form onSubmit={applyPrice} key={sp.get("price") ?? ""} className="mt-4 border-t border-line pt-3">
            <p className="mb-1 text-sm font-semibold">Price (₹)</p>
            <div className="flex items-center gap-2">
              <input name="min" inputMode="numeric" aria-label="Minimum price" placeholder={String(Math.floor(price.min / 100))} defaultValue={range?.[0] || ""} className="min-h-10 w-full rounded-lg border border-line px-2 text-sm" />
              <span aria-hidden>–</span>
              <input name="max" inputMode="numeric" aria-label="Maximum price" placeholder={String(Math.ceil(price.max / 100))} defaultValue={range && range[1] < 999999 ? range[1] : ""} className="min-h-10 w-full rounded-lg border border-line px-2 text-sm" />
            </div>
            <p className="mt-1 text-xs text-muted">{formatPaise(price.min)} – {formatPaise(price.max)}</p>
            <Button type="submit" variant="ghost" className="mt-1 min-h-10 border border-line">Apply</Button>
          </form>
        )}

        <div className="sticky bottom-0 mt-6 bg-white pt-3 lg:hidden"><Button className="w-full" onClick={() => setOpen(false)}>Show {total} result{total === 1 ? "" : "s"}</Button></div>
      </aside>
    </>
  );
}
