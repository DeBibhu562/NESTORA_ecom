import Link from "next/link";
import type { Facet } from "@/lib/api";
import { parsePrice, qs, setParam, toggle } from "@/lib/filters";

/** Removable chips for every active filter (server component: each chip is a plain link). */
export function ActiveChips({ path, sp, facets }: { path: string; sp: URLSearchParams; facets: Facet[] }) {
  const chips: { label: string; href: string }[] = [];
  for (const f of facets) for (const v of sp.getAll(f.key)) chips.push({ label: `${f.label}: ${f.values.find((x) => x.value === v)?.label ?? v}`, href: `${path}${qs(toggle(sp, f.key, v))}` });
  const pr = parsePrice(sp.get("price"));
  if (pr) chips.push({ label: `₹${pr[0]} – ${pr[1] >= 999999 ? "any" : `₹${pr[1]}`}`, href: `${path}${qs(setParam(sp, "price", null))}` });
  if (sp.has("in_stock")) chips.push({ label: "In stock", href: `${path}${qs(setParam(sp, "in_stock", null))}` });
  if (!chips.length) return null;
  const clear = new URLSearchParams(); if (sp.get("sort")) clear.set("sort", sp.get("sort")!); if (sp.get("q")) clear.set("q", sp.get("q")!);
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => <li key={c.label}><Link href={c.href} scroll={false} className="inline-flex min-h-9 items-center gap-1 rounded-sm bg-soft-hover px-3 text-xs font-semibold hover:bg-line">{c.label}<span aria-hidden>✕</span><span className="sr-only">remove filter</span></Link></li>)}
      <li><Link href={`${path}${qs(clear)}`} scroll={false} className="text-xs underline">Clear all</Link></li>
    </ul>
  );
}
