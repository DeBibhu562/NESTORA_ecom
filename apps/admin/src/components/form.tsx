"use client";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ApiError } from "@/lib/api";

export const inputCls = "w-full rounded-lg border border-line bg-white px-3 min-h-11 text-sm focus-visible:outline-2 focus-visible:outline-brand";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className ?? ""}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${inputCls} py-2 ${p.className ?? ""}`} />;

export function Problems({ error }: { error: unknown }) {
  if (!error) return null;
  const lines = error instanceof ApiError ? error.lines : [error instanceof Error ? error.message : "Something went wrong"];
  return (
    <ul role="alert" className="space-y-1 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm text-brand">
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}

export const Card = ({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) => (
  <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
    {(title || actions) && <div className="flex items-center justify-between"><h2 className="text-lg">{title}</h2>{actions}</div>}
    {children}
  </section>
);
