import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveChips } from "@/components/ActiveChips";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FilterPanel } from "@/components/FilterPanel";
import { JsonLd } from "@/components/JsonLd";
import { Pagination } from "@/components/Pagination";
import { ProductGrid } from "@/components/ProductGrid";
import { SortSelect } from "@/components/SortSelect";
import { apiGet, BRAND, orNotFound, SITE_URL, type ListResponse } from "@/lib/api";
import { isFiltered, toSearchParams, type Params } from "@/lib/filters";

type Props = { params: Promise<{ path: string[] }>; searchParams: Promise<Params> };
const SEGMENT = /^[a-z0-9-]+$/;

async function load({ params, searchParams }: Props) {
  const path = (await params).path;
  if (!path.every((s) => SEGMENT.test(s))) notFound();
  const sp = toSearchParams(await searchParams);
  const query = new URLSearchParams(sp); query.set("category", path.join("/"));
  return { path: `/c/${path.join("/")}`, sp, data: await orNotFound(apiGet<ListResponse>(`/catalog/products?${query}`)) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { path, sp, data } = await load(props);
  const c = data.category!;
  const page = data.page > 1 ? ` – Page ${data.page}` : "";
  return {
    title: `${c.seoTitle ?? c.name}${page}`,
    description: c.seoDesc ?? c.description ?? `Shop ${c.name} at ${BRAND}.`,
    alternates: { canonical: data.page > 1 && !isFiltered(sp) ? `${path}?page=${data.page}` : path },
    robots: isFiltered(sp) ? { index: false, follow: true } : undefined, // faceted URLs are for people, not the index
  };
}

export default async function CollectionPage(props: Props) {
  const { path, sp, data } = await load(props);
  const c = data.category!;
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: c.breadcrumbs.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: `${SITE_URL}/c/${b.path}` })) }} />
      <Breadcrumbs crumbs={c.breadcrumbs.slice(0, -1)} current={c.name} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl md:text-4xl">{c.name}</h1><p className="mt-1 text-sm text-muted" aria-live="polite">{data.total} product{data.total === 1 ? "" : "s"}</p></div>
        <SortSelect />
      </div>
      {c.children.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Sub-categories">{c.children.map((s) => <li key={s.path}><Link href={`/c/${s.path}`} className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm font-semibold hover:bg-soft">{s.name}</Link></li>)}</ul>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_1fr] lg:gap-8">
        <div><FilterPanel facets={data.facets} price={data.price} total={data.total} inStockCount={data.inStockCount} /></div>
        <section aria-label="Products" className="min-w-0 space-y-4">
          <ActiveChips path={path} sp={sp} facets={data.facets} />
          {data.items.length ? <ProductGrid items={data.items} /> : (
            <div className="rounded-2xl bg-soft p-10 text-center"><p className="font-semibold">No products match these filters.</p><Link href={path} className="mt-2 inline-block text-sm underline">Clear all filters</Link></div>
          )}
          <Pagination path={path} sp={sp} page={data.page} pages={data.pages} />
        </section>
      </div>
      {c.description && <p className="mt-12 max-w-3xl text-sm text-muted">{c.description}</p>}
    </main>
  );
}
