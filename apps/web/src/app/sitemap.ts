import type { MetadataRoute } from "next";
import { apiGet, SITE_URL } from "@/lib/api";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await apiGet<{ products: { slug: string; updatedAt: string }[]; categories: string[] }>("/catalog/sitemap", 300).catch(() => ({ products: [], categories: [] }));
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...s.categories.map((c) => ({ url: `${SITE_URL}/c/${c}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...s.products.map((p) => ({ url: `${SITE_URL}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
