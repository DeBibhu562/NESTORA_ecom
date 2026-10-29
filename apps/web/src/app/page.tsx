import Link from "next/link";
import { BannerSlider, type Slide } from "@/components/BannerSlider";
import { HeroSlider, type HeroSlide } from "@/components/HeroSlider";
import { ProductGrid } from "@/components/ProductGrid";
import { API, apiGet, BRAND, type CategoryNode, type ListResponse } from "@/lib/api";
import { FREE_SHIPPING_ABOVE_PAISE } from "@/lib/store";

export const revalidate = 60;

const UP = `${API.replace(/\/v1$/, "")}/uploads/seed`;
const HERO: HeroSlide[] = [
  { eyebrow: "Vacuum insulated", title: "Hot for 24 hours. Cold for 24 hours.", text: "Double-wall stainless steel flasks with leak-proof lids.", cta: "Shop vacuum flasks", href: "/c/bottles/vacuum", image: `${UP}/hero-1.svg`, bg: "#f3f2ef" },
  { eyebrow: "Copper bottles", title: "Hand-finished copper for daily water.", text: "Hammered and plain finishes, made to be used every day.", cta: "Shop copper", href: "/c/bottles/copper", image: `${UP}/hero-2.svg`, bg: "#f4ebe1" },
  { eyebrow: "Sports sippers", title: "Built for the gym and the commute.", text: "Light, BPA-free and one-hand easy. From ₹249.", cta: "Shop sports bottles", href: "/c/bottles/sports", image: `${UP}/hero-3.svg`, bg: "#e9eef4" },
  { eyebrow: "Glass bottles", title: "Clean taste in borosilicate glass.", text: "Fruit infuser bottles with a protective sleeve.", cta: "Shop glass bottles", href: "/c/bottles/glass", image: `${UP}/hero-4.svg`, bg: "#e8f1f2" },
];
const TRUST = [
  { t: "24h hot & cold", d: "Double-wall vacuum insulation", i: "M12 3v10m0 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  { t: "Leak-proof lids", d: "Tested, no spills in your bag", i: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" },
  { t: "Up to 12-month warranty", d: "On every insulated flask", i: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" },
  { t: `Free shipping ₹${FREE_SHIPPING_ABOVE_PAISE / 100}+`, d: "Delivered across India", i: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01" },
];

function Icon({ d }: { d: string }) {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}

const Head = ({ id, title, href, label }: { id: string; title: string; href: string; label: string }) => (
  <div className="mb-5 flex items-end justify-between border-b border-line pb-3"><h2 id={id} className="text-2xl">{title}</h2><Link href={href} className="text-sm font-semibold underline underline-offset-4">{label}</Link></div>
);

export default async function Home() {
  const [tree, best, fresh, slides] = await Promise.all([
    apiGet<CategoryNode[]>("/catalog/categories", 60),
    apiGet<ListResponse>("/catalog/products?sort=featured&limit=8&in_stock=1", 60),
    apiGet<ListResponse>("/catalog/products?sort=newest&limit=4", 60),
    apiGet<Slide[]>("/catalog/banners", 60).catch(() => []),
  ]).catch((): [CategoryNode[], ListResponse | null, ListResponse | null, Slide[]] => [[], null, null, []]);
  const tiles = tree.flatMap((c) => (c.children.length ? c.children : [c]));

  return (
    <main>
      {slides.length > 0 ? <BannerSlider slides={slides} /> : (
        <HeroSlider slides={HERO} />
      )}

      <section aria-label="Why shop with us" className="border-y border-line bg-white">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 px-4 lg:grid-cols-4 lg:divide-x lg:divide-line">
          {TRUST.map((t) => (
            <li key={t.t} className="flex items-center gap-3 px-2 py-4 lg:px-6"><span className="text-ink"><Icon d={t.i} /></span><span><span className="block text-sm font-semibold">{t.t}</span><span className="block text-xs text-muted">{t.d}</span></span></li>
          ))}
        </ul>
      </section>

      {tiles.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="shop-by">
          <Head id="shop-by" title="Shop by category" href="/c/bottles" label="View all" />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.path}`} className="group block">
                  <div className="aspect-square overflow-hidden bg-soft">
                    {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" width={600} height={600} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="grid size-full place-items-center text-4xl font-semibold text-muted">{c.name[0]}</div>}
                  </div>
                  <p className="mt-2 text-sm font-semibold group-hover:underline">{c.name}</p>
                  <p className="text-xs text-muted">{c.productCount} product{c.productCount === 1 ? "" : "s"}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {best && best.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="best">
          <Head id="best" title="Bestsellers" href="/c/bottles" label="View all" />
          <ProductGrid items={best.items.slice(0, 8)} />
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid items-center gap-6 bg-navy p-8 text-white md:grid-cols-[1fr_auto] md:p-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Personalisation</p>
            <h2 className="mt-2 text-3xl md:text-4xl">Name engraving on select flasks</h2>
            <p className="mt-2 text-white/75">Add a name or message at checkout for ₹99. Good for gifts, school and the office.</p>
          </div>
          <Link href="/search?q=thermosteel" className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-8 text-sm font-semibold text-navy transition-colors hover:bg-cream">Shop engravable flasks</Link>
        </div>
      </section>

      {fresh && fresh.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10" aria-labelledby="new">
          <Head id="new" title="New arrivals" href="/search?sort=newest" label="View all" />
          <ProductGrid items={fresh.items} />
        </section>
      )}

      <section className="border-t border-line bg-cream py-12" aria-labelledby="why">
        <div className="mx-auto max-w-7xl px-4">
          <h2 id="why" className="mb-6 text-2xl">Why {BRAND}</h2>
          <ul className="grid gap-8 md:grid-cols-3">
            {[["Made to last", "Food-grade SS 304 and rust-resistant finishes, built for daily use for years."], ["Honest pricing", "GST-inclusive prices and no surprise charges at checkout."], ["Support that answers", "Track every order, cancel easily, and get quick help when you need it."]].map(([t, d]) => (
              <li key={t} className="border-t-2 border-navy pt-4"><h3 className="text-lg font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></li>
            ))}
          </ul>
        </div>
      </section>

      {!best && <p className="p-10 text-center text-muted">{BRAND} is getting ready. Please check back soon.</p>}
    </main>
  );
}
