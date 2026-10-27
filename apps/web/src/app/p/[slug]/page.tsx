import type { Metadata } from "next";
import { Accordion } from "@app/ui";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductHero } from "@/components/ProductHero";
import { apiGet, BRAND, orNotFound, SITE_URL, type ProductDetail } from "@/lib/api";
import { FREE_SHIPPING_ABOVE_PAISE } from "@/lib/store";
import { formatPaise } from "@app/ui";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ variant?: string }> };
const load = async (slug: string) => orNotFound(apiGet<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug);
  const description = p.seoDesc ?? p.tagline ?? `Buy ${p.title} at ${BRAND}.`;
  return {
    title: p.seoTitle ?? p.title, description, alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: p.title, description, type: "website", images: p.media[0] ? [{ url: p.media[0].url, width: p.media[0].width, height: p.media[0].height }] : undefined },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const p = await load((await params).slug);
  const sku = (await searchParams).variant;
  const prices = p.variants.map((v) => v.pricePaise);
  const anyStock = p.variants.some((v) => v.inStock);

  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, description: p.tagline ?? undefined, sku: p.variants[0]?.sku, brand: { "@type": "Brand", name: BRAND },
    image: p.media.map((m) => m.url), url: `${SITE_URL}/p/${p.slug}`,
    ...(p.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
    offers: {
      "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: Math.min(...prices) / 100, highPrice: Math.max(...prices) / 100, offerCount: p.variants.length,
      availability: anyStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [...p.breadcrumbs.map((b) => ({ name: b.name, item: `${SITE_URL}/c/${b.path}` })), { name: p.title, item: `${SITE_URL}/p/${p.slug}` }].map((x, i) => ({ "@type": "ListItem", position: i + 1, ...x })) };

  return (
    <main className="mx-auto max-w-7xl space-y-12 px-4 py-6">
      <JsonLd data={ld} /><JsonLd data={crumbs} />
      <div className="space-y-4">
        <Breadcrumbs crumbs={p.breadcrumbs} current={p.title} />
        <ProductHero product={p} initialSku={sku} />
      </div>

      <section aria-label="Product information" className="max-w-3xl">
        <Accordion defaultOpen="description" items={[
          { id: "description", title: "Description", content: <div className="prose-sm space-y-2 [&_li]:ml-5 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} /> },
          ...(p.specs.length ? [{ id: "specs", title: "Specifications", content: <dl className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-x-4 gap-y-2">{p.specs.map((s) => <div key={s.label} className="contents"><dt className="font-semibold text-ink">{s.label}</dt><dd>{s.value}</dd></div>)}</dl> }] : []),
          { id: "shipping", title: "Shipping & returns", content: <p>Free shipping on orders above {formatPaise(FREE_SHIPPING_ABOVE_PAISE)}. Easy 7-day returns on unused items in original packaging.</p> },
        ]} />
      </section>

      {p.related.length > 0 && (
        <section aria-labelledby="related"><h2 id="related" className="mb-4 text-2xl">You may also like</h2><ProductGrid items={p.related.slice(0, 4)} /></section>
      )}
    </main>
  );
}
