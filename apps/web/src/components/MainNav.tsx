"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CategoryNode } from "@/lib/api";

export function MainNav({ tree }: { tree: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { // Esc closes the mobile menu
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  return (
    <>
      {/* desktop: dropdown opens on hover and on keyboard focus */}
      <nav aria-label="Categories" className="hidden gap-1 lg:flex">
        {tree.map((c) => (
          <div key={c.id} className="group relative">
            <Link href={`/c/${c.path}`} className="inline-flex min-h-11 items-center rounded-sm px-4 text-sm font-semibold hover:bg-soft">{c.name}{c.children.length > 0 && <span aria-hidden className="ml-1 text-xs">▾</span>}</Link>
            {c.children.length > 0 && (
              <div className="invisible absolute left-0 top-full z-40 w-64 rounded-2xl border border-line bg-white p-2 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <Link href={`/c/${c.path}`} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-soft">All {c.name}</Link>
                {c.children.map((s) => <Link key={s.id} href={`/c/${s.path}`} className="flex justify-between rounded-lg px-3 py-2 text-sm hover:bg-soft">{s.name}<span className="text-muted">{s.productCount}</span></Link>)}
              </div>
            )}
          </div>
        ))}
      </nav>

      <button className="grid size-11 place-items-center rounded-full hover:bg-soft lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-4">
            <button className="mb-2 min-h-11 text-sm underline" autoFocus onClick={() => setOpen(false)}>Close</button>
            {tree.map((c) => (
              <div key={c.id} className="mb-3">
                <Link href={`/c/${c.path}`} onClick={() => setOpen(false)} className="block py-2 font-semibold">{c.name}</Link>
                {c.children.map((s) => <Link key={s.id} href={`/c/${s.path}`} onClick={() => setOpen(false)} className="block py-2 pl-4 text-sm text-muted">{s.name}</Link>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
