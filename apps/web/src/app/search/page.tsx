import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { Pagination } from "@/components/Pagination";
import { SearchBox } from "@/components/SearchBox";
import { apiGet, orNotFound, type ListResponse } from "@/lib/api";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", page = "1" } = await searchParams;
  const term = q.trim().slice(0, 80);
  const data = term ? await orNotFound(apiGet<ListResponse>(`/catalog/products?${new URLSearchParams({ q: term, page })}`)) : null;
  const sp = new URLSearchParams({ q: term });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-3xl">{term ? <>Results for “{term}”</> : "Search"}</h1>
      <div className="mt-4 max-w-xl"><SearchBox initial={term} /></div>
      {data && <p className="mt-3 text-sm text-muted" aria-live="polite">{data.total} result{data.total === 1 ? "" : "s"}</p>}
      <div className="mt-6">
        {data && data.items.length > 0 && <><ProductGrid items={data.items} /><Pagination path="/search" sp={sp} page={data.page} pages={data.pages} /></>}
        {data && data.items.length === 0 && (
          <div className="rounded-2xl bg-soft p-10 text-center"><p className="font-semibold">Nothing found for “{term}”.</p><p className="mt-1 text-sm text-muted">Check the spelling or try a broader word like “bottle”.</p><Link href="/c/bottles" className="mt-3 inline-block text-sm underline">Browse all bottles</Link></div>
        )}
      </div>
    </main>
  );
}
