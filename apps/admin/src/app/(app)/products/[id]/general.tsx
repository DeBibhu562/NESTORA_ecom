"use client";
import { Button } from "@app/ui";
import { useState, type FormEvent } from "react";
import { Field, Input, Problems, Select, Textarea } from "@/components/form";
import { patch, type Product } from "@/lib/api";
import { parseRupees } from "@/lib/money";
import { GST_SLABS } from "@/lib/constants";

export function General({ p, onSaved, canWrite }: { p: Product; onSaved: (p: Product) => void; canWrite: boolean }) {
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [pers, setPers] = useState(p.personalizationEnabled);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const persPrice = pers ? parseRupees(String(f.get("persPrice"))) : null;
    if (pers && !persPrice) return setError(new Error("Enter the engraving price in rupees"));
    setError(undefined); setSaved(false);
    try {
      onSaved(await patch<Product>(`/admin/products/${p.id}`, {
        title: f.get("title"), tagline: String(f.get("tagline")) || undefined, descriptionHtml: f.get("description"),
        hsnCode: f.get("hsnCode"), gstRateBp: Number(f.get("gst")),
        badges: String(f.get("badges")).split(",").map((s) => s.trim()).filter(Boolean),
        warrantyMonths: f.get("warranty") === "" ? undefined : Number(f.get("warranty")),
        personalizationEnabled: pers, ...(persPrice ? { personalizationPricePaise: persPrice } : {}),
      }));
      setSaved(true);
    } catch (err) { setError(err); }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-4">
      <fieldset disabled={!canWrite} className="space-y-4">
        <Field label="Title"><Input name="title" defaultValue={p.title} required minLength={2} /></Field>
        <Field label="Tagline"><Input name="tagline" defaultValue={p.tagline ?? ""} maxLength={200} /></Field>
        <Field label="Description" hint="Basic HTML allowed (p, lists, headings, links). Anything else is stripped on save."><Textarea name="description" rows={7} defaultValue={p.descriptionHtml} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="HSN code"><Input name="hsnCode" defaultValue={p.hsnCode} pattern="\d{4,8}" required /></Field>
          <Field label="GST rate"><Select name="gst" defaultValue={p.gstRateBp}>{GST_SLABS.map((b) => <option key={b} value={b}>{b / 100}%</option>)}</Select></Field>
          <Field label="Warranty (months)"><Input name="warranty" type="number" min={0} max={120} defaultValue={p.warrantyMonths ?? ""} /></Field>
        </div>
        <Field label="Badges" hint="Comma separated, e.g. Bestseller, New"><Input name="badges" defaultValue={p.badges.join(", ")} /></Field>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={pers} onChange={(e) => setPers(e.target.checked)} className="size-4" />Offer name engraving</label>
          {pers && <Field label="Engraving price (₹)"><Input name="persPrice" defaultValue={p.personalizationPricePaise ? String(p.personalizationPricePaise / 100) : "99"} inputMode="decimal" /></Field>}
        </div>
      </fieldset>
      <Problems error={error} />
      {canWrite && <div className="flex items-center gap-3"><Button type="submit">Save</Button>{saved && <span role="status" className="text-sm text-success">Saved</span>}</div>}
    </form>
  );
}
