"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, get, post } from "@/lib/api";
import { can, MeCtx, type Me } from "@/lib/me";

const NAV = [
  { href: "/", label: "Dashboard", perm: null },
  { href: "/products", label: "Products", perm: "product:read" },
  { href: "/categories", label: "Categories", perm: "category:read" },
  { href: "/inventory", label: "Inventory", perm: "inventory:read" },
  { href: "/security", label: "Security", perm: null },
];

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    get<Me>("/admin/auth/me").then(setMe).catch((e) => { if (e instanceof ApiError && e.status === 401) router.replace("/login"); });
  }, [router]);

  if (!me) return <p className="p-8 text-muted">Loading…</p>;
  const nav = NAV.filter((n) => !n.perm || can(me, n.perm));

  return (
    <MeCtx.Provider value={me}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="bg-navy p-4 text-white md:w-56 md:shrink-0">
          <div className="mb-4 font-[family-name:var(--font-heading)] text-xl">Admin</div>
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
            {nav.map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm ${active ? "bg-white/15 font-semibold" : "hover:bg-white/10"}`}>{n.label}</Link>;
            })}
          </nav>
          <div className="mt-6 hidden text-xs text-white/70 md:block">
            <div>{me.name}</div><div>{me.role}</div>
            <button className="mt-2 underline" onClick={async () => { await post("/admin/auth/logout").catch(() => undefined); router.replace("/login"); }}>Sign out</button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          {!me.mfa && path !== "/security" && (
            <p className="mb-4 rounded-lg bg-gold/20 p-3 text-sm">Two-factor authentication is not enabled. <Link className="underline" href="/security">Set it up</Link>.</p>
          )}
          {children}
        </main>
      </div>
    </MeCtx.Provider>
  );
}
