import Link from "next/link";
import type { Crumb } from "@/lib/api";

export function Breadcrumbs({ crumbs, current }: { crumbs: Crumb[]; current?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li><Link href="/" className="hover:underline">Home</Link></li>
        {crumbs.map((c) => <li key={c.path} className="flex items-center gap-1"><span aria-hidden>/</span><Link href={`/c/${c.path}`} className="hover:underline">{c.name}</Link></li>)}
        {current && <li className="flex items-center gap-1" aria-current="page"><span aria-hidden>/</span><span className="text-ink">{current}</span></li>}
      </ol>
    </nav>
  );
}
