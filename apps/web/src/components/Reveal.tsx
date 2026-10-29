"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Fades children up when scrolled into view. Server HTML is visible; class is added after mount so no-JS stays readable. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) return; // already on screen: don't flash
    el.classList.add("reveal");
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className} style={{ ["--d" as string]: `${delay}ms` }}>{children}</div>;
}
