import Link from "next/link";
import { apiGet, BRAND, type CategoryNode } from "@/lib/api";
import { NestoraLogo } from "./NestoraLogo";

export async function Footer() {
  const tree = await apiGet<CategoryNode[]>("/catalog/categories", 60).catch(() => []);
  return (
    <footer className="mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div><NestoraLogo variant="footer" /><p className="mt-3 max-w-sm text-sm text-white/70">Everyday drinkware and kitchen essentials, made to last.</p></div>
        <nav aria-label="Shop"><p className="mb-2 text-sm font-semibold">Shop</p>
          <ul className="space-y-1 text-sm text-white/70">{tree.flatMap((c) => [c, ...c.children]).map((c) => <li key={c.id}><Link href={`/c/${c.path}`} className="hover:text-white hover:underline">{c.name}</Link></li>)}</ul>
        </nav>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/60">© {new Date().getFullYear()} {BRAND}. All prices are inclusive of taxes.</p>
    </footer>
  );
}
