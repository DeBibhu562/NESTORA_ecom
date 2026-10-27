import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { apiGet, BRAND, type CategoryNode, type ListResponse } from "@/lib/api";

export const revalidate = 60;

export default async function Home() {
  const [tree, best, fresh] = await Promise.all([
    apiGet<CategoryNode[]>("/catalog/categories", 60),
    apiGet<ListResponse>("/catalog/products?sort=featured&limit=8&in_stock=1", 60),
    apiGet<ListResponse>("/catalog/products?sort=newest&limit=4", 60),
  ]).catch(() => [[], null, null] as const);
  const circles = tree.flatMap((c) => (c.children.length ? c.children : [c]));

  return (
    <main>
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:py-20">
          <h1 className="max-w-2xl text-4xl leading-tight md:text-6xl">Drinkware that keeps up with your day.</h1>
          <p className="max-w-xl text-white/80">Insulated, leak-proof and built to last. Hot for 24 hours, cold for 24 hours.</p>
          <div><Link href="/c/bottles" className="inline-flex min-h-12 items-center rounded-full bg-brand px-8 font-semibold hover:bg-brand-hover">Shop bottles</Link></div>
        </div>
      </section>

      {circles.length > 0 && (
        <nav aria-label="Shop by category" className="mx-auto max-w-7xl px-4 py-10">
          <ul className="flex gap-5 overflow-x-auto pb-2">
            {circles.map((c) => (
              <li key={c.id} className="shrink-0 text-center"><Link href={`/c/${c.path}`} className="group block w-24"><span className="mx-auto grid size-20 place-items-center rounded-full bg-soft text-2xl font-semibold text-brand transition-colors group-hover:bg-soft-hover">{c.name[0]}</span><span className="mt-2 block text-sm font-semibold">{c.name}</span></Link></li>
            ))}
          </ul>
        </nav>
      )}

      {best && best.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-6" aria-labelledby="best">
          <div className="mb-4 flex items-end justify-between"><h2 id="best" className="text-2xl md:text-3xl">Bestsellers</h2><Link href="/c/bottles" className="text-sm underline">View all</Link></div>
          <ProductGrid items={best.items.slice(0, 4)} />
        </section>
      )}
      {fresh && fresh.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="new">
          <h2 id="new" className="mb-4 text-2xl md:text-3xl">New arrivals</h2>
          <ProductGrid items={fresh.items} />
        </section>
      )}
      {!best && <p className="p-10 text-center text-muted">{BRAND} is getting ready. Please check back soon.</p>}
    </main>
  );
}
