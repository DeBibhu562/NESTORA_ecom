"use client";
import { Button } from "@app/ui";
import { useState } from "react";
import { Field, Input, Select } from "./form";

export type OptionDraft = { name: string; displayAs: "PILL" | "SWATCH" | "DROPDOWN"; values: string };
export type OptionPayload = { name: string; displayAs: string; values: { value: string; hexColor?: string }[] };

/** "Pink:#e8a0b4, Ivory" → [{value:"Pink",hexColor:"#e8a0b4"},{value:"Ivory"}] */
export function parseValues(text: string) {
  return text.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [value, hex] = s.split(":").map((x) => x.trim());
    return { value: value!, ...(hex ? { hexColor: hex } : {}) };
  });
}

export const toPayload = (d: OptionDraft[]): OptionPayload[] => d.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), displayAs: o.displayAs, values: parseValues(o.values) }));

export function OptionsEditor({ value, onChange }: { value: OptionDraft[]; onChange: (v: OptionDraft[]) => void }) {
  const set = (i: number, patch: Partial<OptionDraft>) => onChange(value.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-3">
      {value.map((o, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-line p-3 md:grid-cols-[10rem_9rem_1fr_auto]">
          <Field label="Option"><Input value={o.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Capacity" /></Field>
          <Field label="Shown as"><Select value={o.displayAs} onChange={(e) => set(i, { displayAs: e.target.value as OptionDraft["displayAs"] })}><option value="PILL">Pills</option><option value="SWATCH">Colour swatches</option><option value="DROPDOWN">Dropdown</option></Select></Field>
          <Field label="Values" hint={o.displayAs === "SWATCH" ? "Comma separated; add a colour as Pink:#e8a0b4" : "Comma separated"}><Input value={o.values} onChange={(e) => set(i, { values: e.target.value })} placeholder="550 ml, 715 ml, 880 ml" /></Field>
          <Button variant="ghost" className="self-end" aria-label={`Remove option ${o.name || i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      {value.length < 3 && <Button variant="ghost" onClick={() => onChange([...value, { name: "", displayAs: "PILL", values: "" }])}>+ Add option</Button>}
    </div>
  );
}

export function useOptionDrafts(initial: OptionDraft[] = []) {
  return useState<OptionDraft[]>(initial);
}
