/** Infinite right-to-left marquee. Content is rendered twice so the loop is seamless; the second copy is hidden from screen readers. */
export type TickerItem = { text: string; strong?: string };

export function Ticker({ items }: { items: TickerItem[] }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((m) => (
        <li key={m.text + (m.strong ?? "")} className="flex items-center whitespace-nowrap px-8 text-xs font-medium tracking-wide">
          {m.strong && <b className="mr-1.5 font-bold uppercase text-[#ff8b7d]">{m.strong}</b>}{m.text}
          <span aria-hidden className="ml-16 text-white/30">◆</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="group flex overflow-hidden bg-navy py-2 text-white" role="region" aria-label="Announcements">
      <div className="flex animate-marquee group-hover:[animation-play-state:paused]">{row(false)}{row(true)}</div>
    </div>
  );
}
