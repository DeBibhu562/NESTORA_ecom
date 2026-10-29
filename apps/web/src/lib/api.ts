import { notFound } from "next/navigation";

// Server components call the API directly; browser code (search suggestions, stock alerts) uses the same base URL.
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4010/v1";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3020";
export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Store";

export type Swatch = { value: string; hex: string | null; image: string | null; inStock: boolean };
export type Card = {
  id: string; slug: string; title: string; tagline: string | null; badges: string[]; ratingAvg: number; ratingCount: number; categoryPath: string; categoryName: string;
  minPricePaise: number; maxPricePaise: number; mrpPaise: number; discountPct: number; inStock: boolean;
  image: { url: string; alt: string; width: number; height: number } | null; hoverImage: { url: string; alt: string } | null; swatches: Swatch[];
};
export type Facet = { key: string; label: string; values: { value: string; label: string; count: number }[] };
export type Crumb = { name: string; path: string };
export type ListResponse = {
  category: { name: string; path: string; description: string | null; imageUrl: string | null; seoTitle: string | null; seoDesc: string | null; breadcrumbs: Crumb[]; children: Crumb[] } | null;
  items: Card[]; total: number; page: number; pages: number; facets: Facet[]; price: { min: number; max: number } | null; inStockCount: number;
};
export type CategoryNode = { id: string; name: string; slug: string; path: string; imageUrl: string | null; productCount: number; children: CategoryNode[] };
export type OptionValue = { id: string; value: string; hexColor: string | null };
export type Option = { id: string; name: string; displayAs: string; values: OptionValue[] };
export type Variant = { id: string; sku: string; pricePaise: number; mrpPaise: number; optionValueIds: string[]; inStock: boolean; maxQty: number; weightGrams: number };
export type MediaItem = { id: string; url: string; alt: string; width: number; height: number; optionValueId: string | null; variantId: string | null };
export type ProductDetail = {
  id: string; slug: string; title: string; tagline: string | null; descriptionHtml: string; badges: string[]; ratingAvg: number; ratingCount: number;
  seoTitle: string | null; seoDesc: string | null; updatedAt: string; personalization: { pricePaise: number | null } | null; breadcrumbs: Crumb[];
  specs: { label: string; value: string }[]; options: Option[]; variants: Variant[]; media: MediaItem[]; related: Card[];
};

export class NotFound extends Error {}

/** Turn an API "not found / bad request" into Next's 404 page. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try { return await p; } catch (e) { if (e instanceof NotFound) notFound(); throw e; }
}

/** Server-side GET with ISR-style caching; 404 → NotFound so pages can call notFound(). */
export async function apiGet<T>(path: string, revalidate = 30): Promise<T> {
  // On the server, prefer the internal address (e.g. http://api:4010/v1) so pages don't loop out through the public IP.
  const res = await fetch(`${process.env.INTERNAL_API_URL ?? API}${path}`, { next: { revalidate } });
  if (res.status === 404 || res.status === 400) throw new NotFound(path);
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}
