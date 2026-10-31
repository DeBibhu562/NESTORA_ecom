import Link from "next/link";
import { apiGet, BRAND, type CategoryNode } from "@/lib/api";
import { FREE_SHIPPING_ABOVE_PAISE } from "@/lib/store";
import { LivowareLogo } from "./LivowareLogo";

const head = "mb-3 text-sm font-bold tracking-wide text-white";
const link = "text-sm text-white/65 transition hover:text-white hover:underline";

export async function Footer() {
  const tree = await apiGet<CategoryNode[]>("/catalog/categories", 60).catch(() => []);
  return (
    <footer className="mt-16 bg-navy text-white">
      <div className="border-b border-white/10">
        <ul className="mx-auto grid max-w-7xl gap-4 px-4 py-6 text-sm sm:grid-cols-3">
          {[`Free shipping above ₹${FREE_SHIPPING_ABOVE_PAISE / 100}`, "Secure online payments", "Track every order"].map((t) => <li key={t} className="flex items-center gap-2 text-white/85"><span className="text-gold" aria-hidden>✓</span>{t}</li>)}
        </ul>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <LivowareLogo variant="footer" />
          <p className="mt-4 max-w-xs text-sm text-white/65">Everyday drinkware made to last. Insulated, leak-proof and built for daily use.</p>
        </div>
        <nav aria-label="Shop"><p className={head}>Shop</p>
          <ul className="space-y-2">{tree.flatMap((c) => [c, ...c.children]).map((c) => <li key={c.id}><Link href={`/c/${c.path}`} className={link}>{c.name}</Link></li>)}</ul>
        </nav>
        <nav aria-label="Help"><p className={head}>Help</p>
          <ul className="space-y-2"><li><Link href="/track" className={link}>Track your order</Link></li><li><Link href="/account" className={link}>My account</Link></li><li><Link href="/search" className={link}>Search products</Link></li></ul>
        </nav>
        <div><p className={head}>Pay securely</p>
          <ul className="flex flex-wrap gap-2 text-xs font-semibold">{["UPI", "Cards", "Net banking", "Wallets", "COD"].map((p) => <li key={p} className="rounded-md bg-white/10 px-2.5 py-1 text-white/80">{p}</li>)}</ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs text-white/55">© {new Date().getFullYear()} {BRAND}. All prices are inclusive of taxes.</p>
    </footer>
  );
}
