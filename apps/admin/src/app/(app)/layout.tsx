"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/CommandPalette";
import { FeedbackProvider } from "@/components/feedback";
import { ApiError, get, post } from "@/lib/api";
import { can, MeCtx, type Me } from "@/lib/me";

const ICONS: Record<string, string> = {
  "/": "M3 11 12 3l9 8v10H3zM9 21v-6h6v6", "/products": "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10", "/categories": "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  "/inventory": "M4 8h16v12H4zM2 4h20v4H2zM10 12h4", "/orders": "M6 3h12l2 4v14H4V7zM4 7h16M9 11h6", "/returns": "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", "/refunds": "M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6", "/customers": "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 3.5-6 8-6s8 2 8 6",
  "/offers": "M20 12 12 20 4 12V4h8zM8 8h.01", "/banners": "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6", "/settings": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L5.5 8.5 3.5 8l-1 3 2 1v2l-2 1 1 3 2-.5 1.5 1.5-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z", "/security": "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
};

const NAV = [
  { group: "Overview", items: [{ href: "/", label: "Dashboard", perm: null }] },
  { group: "Catalog", items: [
    { href: "/products", label: "Products", perm: "product:read" },
    { href: "/categories", label: "Categories", perm: "category:read" },
    { href: "/inventory", label: "Inventory", perm: "inventory:read" },
  ] },
  { group: "Store", items: [{ href: "/orders", label: "Orders", perm: "order:read" }, { href: "/returns", label: "Returns", perm: "return:read" }, { href: "/refunds", label: "Refunds to pay", perm: "order:refund" }, { href: "/customers", label: "Customers", perm: "customer:read" }, { href: "/offers", label: "Offers", perm: "settings:read" }, { href: "/banners", label: "Homepage slides", perm: "banner:read" }, { href: "/settings", label: "Settings", perm: "settings:read" }] },
  { group: "Account", items: [{ href: "/security", label: "Security", perm: null }] },
];

export default function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [menu, setMenu] = useState(false); // mobile menu
  const [find, setFind] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setFind((x) => !x); } };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  useEffect(() => {
    get<Me>("/admin/auth/me").then(setMe).catch((e) => { if (e instanceof ApiError && e.status === 401) router.replace("/login"); });
  }, [router]);
  useEffect(() => setMenu(false), [path]);

  if (!me) return <p className="p-8 text-muted">Loading…</p>;
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((n) => !n.perm || can(me, n.perm)) })).filter((g) => g.items.length);
  const signOut = async () => { await post("/admin/auth/logout").catch(() => undefined); router.replace("/login"); };

  return (
    <MeCtx.Provider value={me}>
      <FeedbackProvider>
        <CommandPalette open={find} onClose={() => setFind(false)} />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-3">Skip to content</a>
        <div className="flex min-h-screen flex-col md:flex-row">
          <header className="flex items-center justify-between bg-navy px-4 py-2 text-white md:hidden">
            <span className="font-[family-name:var(--font-heading)] text-xl">Admin</span>
            <button type="button" aria-expanded={menu} aria-controls="admin-nav" onClick={() => setMenu(!menu)} className="min-h-11 rounded-lg px-3 text-sm hover:bg-white/10">{menu ? "Close" : "Menu"}</button>
          </header>
          <aside id="admin-nav" className={`${menu ? "block" : "hidden"} bg-navy p-4 text-white md:sticky md:top-0 md:block md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto`}>
            <div className="mb-4 hidden font-[family-name:var(--font-heading)] text-xl md:block">Livoware <span className="text-white/60">Admin</span></div>
            <button type="button" onClick={() => setFind(true)} className="mb-5 flex min-h-11 w-full items-center justify-between rounded-lg bg-white/10 px-3 text-sm text-white/70 hover:bg-white/15"><span>Search…</span><kbd className="rounded bg-white/15 px-1.5 py-0.5 text-xs">⌘K</kbd></button>
            <nav aria-label="Main" className="space-y-5">
              {groups.map((g) => (
                <div key={g.group}>
                  <p className="mb-1 px-3 text-xs uppercase tracking-wide text-white/60">{g.group}</p>
                  <ul className="space-y-1">
                    {g.items.map((n) => {
                      const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
                      return <li key={n.href}><Link href={n.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition ${active ? "bg-white/15 font-semibold shadow-[inset_3px_0_0_var(--color-brand)]" : "text-white/85 hover:bg-white/10"}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 opacity-80"><path d={ICONS[n.href]} /></svg>{n.label}</Link></li>;
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="mt-6 border-t border-white/15 pt-4 text-xs text-white/70">
              <div className="font-semibold text-white">{me.name}</div><div>{me.role}</div>
              <button type="button" className="mt-2 min-h-11 underline" onClick={signOut}>Sign out</button>
            </div>
          </aside>
          <main id="main" className="min-w-0 flex-1 p-4 md:p-8">
            {!me.mfa && path !== "/security" && (
              <p className="mb-4 rounded-lg bg-gold/20 p-3 text-sm">Two-factor authentication is not enabled. <Link className="underline" href="/security">Set it up</Link>.</p>
            )}
            {children}
          </main>
        </div>
      </FeedbackProvider>
    </MeCtx.Provider>
  );
}
