import Link from "next/link";
import { apiGet, BRAND, type CategoryNode } from "@/lib/api";
import { ANNOUNCEMENTS } from "@/lib/store";
import { AccountButton } from "./AccountButton";
import { CartButton } from "./CartButton";
import { MainNav } from "./MainNav";
import { LivowareLogo } from "./LivowareLogo";
import { SearchBox } from "./SearchBox";
import { Ticker } from "./Ticker";

export async function Header() {
  const tree = await apiGet<CategoryNode[]>("/catalog/categories", 60).catch(() => []); // header must render even if the API is down
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90">
      <Ticker items={ANNOUNCEMENTS} />
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <MainNav tree={tree} />
        <Link href="/" aria-label={`${BRAND} home`} className="shrink-0"><LivowareLogo variant="header" /></Link>
        <div className="mx-2 hidden flex-1 md:block"><SearchBox /></div>
        <Link href="/search" className="ml-auto grid size-11 place-items-center rounded-full hover:bg-soft md:hidden" aria-label="Search">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </Link>
        <div className="flex md:ml-auto"><AccountButton /><CartButton /></div>
      </div>
    </header>
  );
}
