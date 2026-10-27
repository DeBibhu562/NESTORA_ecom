"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { qs, setParam } from "@/lib/filters";

const OPTIONS = [["featured", "Featured"], ["newest", "Newest"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"]] as const;

export function SortSelect() {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Sort by</span>
      <select value={sp.get("sort") ?? "featured"} onChange={(e) => router.push(`${path}${qs(setParam(sp, "sort", e.target.value === "featured" ? null : e.target.value))}`, { scroll: false })} className="min-h-11 rounded-full border border-line bg-white px-3 font-semibold">
        {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
