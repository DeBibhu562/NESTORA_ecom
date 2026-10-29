"use client";
import { Button } from "@app/ui";
import { useEffect, useState, type FormEvent } from "react";
import { Field, Input, Problems, Select, Textarea } from "@/components/form";
import { flattenCategories, get, patch, post, type Category, type Product } from "@/lib/api";
import { parseRupees } from "@/lib/money";
import { GST_SLABS } from "@/lib/constants";

export function General({ p, onSaved, canWrite }: { p: Product; onSaved: (p: Product) => void; canWrite: boolean }) {
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [pers, setPers] = useState(p.personalizationEnabled);
  const [cats, setCats] = useState<(Category & { depth: number })[]>([]);
  const [seoT, setSeoT] = useState(p.seoTitle ?? "");
  const [seoD, setSeoD] = useState(p.seoDesc ?? "");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandId, setBrandId] = useState(p.brandId ?? "");
  useEffect(() => { get<{ id: string; name: string }[]>("/admin/brands").then(setBrands).catch(() => undefined); }, []);
  async function addBrand() {
    const name = window.prompt("New brand name")?.trim();
    if (!name) return;
    try { const b = await post<{ id: string; name: string }>("/admin/brands", { name }); setBrands((x) => (x.some((y) => y.id === b.id) ? x : [...x, b].sort((a, c) => a.name.localeCompare(c.name)))); setBrandId(b.id); } catch (e) { setError(e); }
  }
  useEffect(() => { get<Category[]>("/admin/categories").then((t) => setCats(flattenCategories(t))).catch(() => undefined); }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const persPrice = pers ? parseRupees(String(f.get("persPrice"))) : null;
    if (pers && !persPrice) return setError(new Error("Enter the engraving price in rupees"));
    setError(undefined); setSaved(false);
    try {
      onSaved(await patch<Product>(`/admin/products/${p.id}`, {
        title: f.get("title"), slug: f.get("slug"), brandId: brandId || null, categoryId: f.get("categoryId"), seoTitle: seoT || undefined, seoDesc: seoD || undefined, tagline: String(f.get("tagline")) || undefined, descriptionHtml: f.get("description"),
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><Select name="categoryId" defaultValue={p.categoryId} key={cats.length}>{cats.length === 0 && <option value={p.categoryId}>Loading…</option>}{cats.map((c) => <option key={c.id} value={c.id}>{"– ".repeat(c.depth)}{c.name}</option>)}</Select></Field>
          <Field label="URL slug" hint="Changing this changes the product link on the store."><Input name="slug" defaultValue={p.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
        </div>
        <Field label="Brand"><div className="flex gap-2"><Select value={brandId} onChange={(e) => setBrandId(e.target.value)}><option value="">No brand</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select><button type="button" onClick={addBrand} className="min-h-11 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold hover:bg-soft">+ New brand</button></div></Field>
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
        <div className="space-y-3 rounded-xl bg-soft p-4">
          <h3 className="text-lg">Search engine listing</h3>
          <div className="rounded-lg bg-white p-3 text-sm shadow-card"><p className="truncate text-[#1a0dab]">{seoT || p.title}</p><p className="truncate text-xs text-success">yourstore.com › p › {p.slug}</p><p className="line-clamp-2 text-xs text-muted">{seoD || p.tagline || "Add a short description so shoppers know what to expect."}</p></div>
          <Field label={`Page title (${seoT.length}/70)`}><Input value={seoT} onChange={(e) => setSeoT(e.target.value)} maxLength={70} placeholder={p.title} /></Field>
          <Field label={`Meta description (${seoD.length}/170)`}><Textarea rows={2} value={seoD} onChange={(e) => setSeoD(e.target.value)} maxLength={170} /></Field>
        </div>
      </fieldset>
      <Problems error={error} />
      {canWrite && <div className="flex items-center gap-3"><Button type="submit">Save</Button>{saved && <span role="status" className="text-sm text-success">Saved</span>}</div>}
    </form>
  );
}
