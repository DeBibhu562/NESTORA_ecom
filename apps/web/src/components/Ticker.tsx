"use client";
import { useEffect, useState } from "react";

export function Ticker({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 4500);
    return () => clearInterval(t);
  }, [messages.length]);
  return <p className="bg-navy px-4 py-2 text-center text-xs font-medium text-white">{messages[i]}</p>;
}
