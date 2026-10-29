import Link from "next/link";
import { qs, setParam } from "@/lib/filters";

/** Real links (crawlable, work without JS). Shows first, last and a window around the current page. */
export function Pagination({ path, sp, page, pages }: { path: string; sp: URLSearchParams; page: number; pages: number }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const href = (n: number) => `${path}${qs(setParam(sp, "page", n === 1 ? null : String(n)))}`;
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1">
      {page > 1 && <Link rel="prev" href={href(page - 1)} className="grid min-h-11 place-items-center rounded-sm px-4 text-sm hover:bg-soft">Previous</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - nums[i - 1]! > 1 && <span aria-hidden className="px-1 text-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`grid size-11 place-items-center rounded-full text-sm ${n === page ? "bg-navy font-semibold text-white" : "hover:bg-soft"}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link rel="next" href={href(page + 1)} className="grid min-h-11 place-items-center rounded-sm px-4 text-sm hover:bg-soft">Next</Link>}
    </nav>
  );
}
