/** Livoware mark and wordmark. Uses currentColor for the text so the footer (white) and header (navy) share one component. */
export function LivowareLogo({ variant = "header", className = "" }: { variant?: "header" | "footer"; className?: string }) {
  const footer = variant === "footer";
  return (
    <div className={`flex select-none items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 40 40" className={footer ? "size-10" : "size-9 sm:size-10"} aria-hidden>
        <rect width="40" height="40" rx="4" fill={footer ? "#ffffff" : "#072835"} />
        {/* an "L" whose foot is a bottle base */}
        <path d="M13 8h5v19h11v5H13z" fill={footer ? "#072835" : "#ffffff"} />
        <rect x="21" y="8" width="6" height="4" fill="#c4301c" />
      </svg>
      <div className="flex flex-col justify-center leading-none">
        <span className={`font-heading text-xl font-extrabold tracking-[0.12em] sm:text-2xl ${footer ? "text-white" : "text-navy"}`}>LIVOWARE</span>
        <span className={`mt-1 text-[9px] font-medium uppercase tracking-[0.22em] sm:text-[10px] ${footer ? "text-white/60" : "text-muted"}`}>Drinkware &amp; Homeware</span>
      </div>
    </div>
  );
}
