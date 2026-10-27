import type { Card } from "@/lib/api";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ items }: { items: Card[] }) {
  return <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{items.map((c, i) => <li key={c.id} className="flex"><ProductCard card={c} priority={i < 4} /></li>)}</ul>;
}
