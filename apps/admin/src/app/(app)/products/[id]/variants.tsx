"use client";
import { Button } from "@app/ui";
import { useMemo, useState } from "react";
import { Field, Input, Problems } from "@/components/form";
import { OptionsEditor, toPayload, type OptionDraft } from "@/components/options-editor";
import { patch, post, put, type Product, type Variant, type Warehouse } from "@/lib/api";
import { parseRupees } from "@/lib/money";

type Row = { price: string; mrp: string; weight: string; barcode: string; active: boolean; stock: string };

const toRow = (v: Variant, wh: Warehouse | null): Row => ({
  price: String(v.pricePaise / 100), mrp: String(v.mrpPaise / 100), weight: String(v.weightGrams), barcode: v.barcode ?? "", active: v.isActive,
  stock: String(v.inventory.find((i) => i.warehouseId === wh?.id)?.onHand ?? 0),
});

export function Variants({ p, wh, onChange, reload, canWrite, canStock }: { p: Product; wh: Warehouse | null; onChange: (p: Product) => void; reload: () => Promise<void>; canWrite: boolean; canStock: boolean }) {
  const [error, setError] = useState<unknown>();
  const [note, setNote] = useState("");
  const label = useMemo(() => {
    const names = new Map(p.options.flatMap((o) => o.values.map((v) => [v.id, v.value] as const)));
    return (v: Variant) => v.options.map((o) => names.get(o.optionValueId)).join(" / ");
  }, [p.options]);

  // ── option definition (only before variants exist) ──
  const [drafts, setDrafts] = useState<OptionDraft[]>(p.options.map((o) => ({ name: o.name, displayAs: o.displayAs as OptionDraft["displayAs"], values: o.values.map((v) => (v.hexColor ? `${v.value}:${v.hexColor}` : v.value)).join(", ") })));
  // ── generator defaults ──
  const [gen, setGen] = useState({ skuPrefix: p.slug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase(), price: "", mrp: "", weight: "" });
  // ── grid edits ──
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(p.variants.map((v) => [v.id, toRow(v, wh)])));
  const [newValue, setNewValue] = useState<Record<string, string>>({});

  const run = async (fn: () => Promise<void>) => { setError(undefined); setNote(""); try { await fn(); } catch (e) { setError(e); } };

  const saveOptions = () => run(async () => { onChange(await put<Product>(`/admin/products/${p.id}/options`, toPayload(drafts))); setNote("Options saved"); });

  const generate = () => run(async () => {
    const price = parseRupees(gen.price), mrp = parseRupees(gen.mrp), weightGrams = Number(gen.weight);
    if (!price || !mrp || !weightGrams) throw new Error("Enter price, MRP (₹) and weight (g)");
    if (mrp < price) throw new Error("MRP must be at least the selling price");
    const r = await post<{ created: number; product: Product }>(`/admin/products/${p.id}/variants/generate`, { skuPrefix: gen.skuPrefix, pricePaise: price, mrpPaise: mrp, weightGrams });
    onChange(r.product); setRows(Object.fromEntries(r.product.variants.map((v) => [v.id, toRow(v, wh)])));
    setNote(r.created ? `Created ${r.created} variants` : "Nothing new to create");
  });

  const addValue = (optionId: string) => run(async () => {
    const [value, hexColor] = (newValue[optionId] ?? "").split(":").map((s) => s.trim());
    if (!value) return;
    await post(`/admin/products/${p.id}/options/${optionId}/values`, { value, ...(hexColor ? { hexColor } : {}) });
    setNewValue((n) => ({ ...n, [optionId]: "" })); await reload(); setNote(`Added "${value}". Press Generate to create its variants.`);
  });

  const saveGrid = () => run(async () => {
    const patches: Record<string, unknown>[] = [], stock: { variantId: string; to: number }[] = [];
    for (const v of p.variants) {
      const r = rows[v.id]!, o = toRow(v, wh), d: Record<string, unknown> = { id: v.id };
      if (r.price !== o.price) { const x = parseRupees(r.price); if (!x) throw new Error(`${v.sku}: invalid price`); d.pricePaise = x; }
      if (r.mrp !== o.mrp) { const x = parseRupees(r.mrp); if (!x) throw new Error(`${v.sku}: invalid MRP`); d.mrpPaise = x; }
      if (r.weight !== o.weight) { if (!(Number(r.weight) > 0)) throw new Error(`${v.sku}: invalid weight`); d.weightGrams = Number(r.weight); }
      if (r.barcode !== o.barcode) d.barcode = r.barcode || null;
      if (r.active !== o.active) d.isActive = r.active;
      if (Object.keys(d).length > 1) patches.push(d);
      if (r.stock !== o.stock) { const n = Number(r.stock); if (!Number.isInteger(n) || n < 0) throw new Error(`${v.sku}: invalid stock`); stock.push({ variantId: v.id, to: n }); }
    }
    if (!patches.length && !stock.length) return setNote("No changes");
    if (patches.length) await patch(`/admin/products/${p.id}/variants`, patches);
    if (stock.length && wh) for (const s of stock) await post("/admin/inventory/adjust", { variantId: s.variantId, warehouseId: wh.id, reason: "ADJUST", setOnHand: s.to });
    await reload(); setNote(`Saved ${patches.length} variant(s), ${stock.length} stock change(s)`);
  });

  // keep the grid in sync after a reload() replaced p.variants
  const synced = useMemo(() => Object.fromEntries(p.variants.map((v) => [v.id, rows[v.id] ?? toRow(v, wh)])), [p.variants, rows, wh]);
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...synced[id]!, ...patch } }));

  const locked = p.variants.length > 0;
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-lg">Options</h3>
        {locked ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Options are locked once variants exist. You can still add values.</p>
            {p.options.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                <strong className="w-24">{o.name}</strong>
                {o.values.map((v) => <span key={v.id} className="inline-flex items-center gap-1 rounded-full bg-soft px-3 py-1">{v.hexColor && <i className="size-3 rounded-full border border-line" style={{ background: v.hexColor }} />}{v.value}</span>)}
                {canWrite && <><Input aria-label={`New ${o.name} value`} placeholder="New value" value={newValue[o.id] ?? ""} onChange={(e) => setNewValue((n) => ({ ...n, [o.id]: e.target.value }))} className="max-w-40" /><Button variant="ghost" onClick={() => addValue(o.id)}>Add</Button></>}
              </div>
            ))}
          </div>
        ) : (
          <fieldset disabled={!canWrite} className="space-y-3"><OptionsEditor value={drafts} onChange={setDrafts} />{canWrite && <Button onClick={saveOptions}>Save options</Button>}</fieldset>
        )}
      </section>

      {canWrite && p.options.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg">Generate variants</h3>
          <p className="text-sm text-muted">Creates one variant per combination (existing ones are skipped). Fine-tune each below.</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="SKU prefix"><Input value={gen.skuPrefix} onChange={(e) => setGen({ ...gen, skuPrefix: e.target.value.toUpperCase() })} /></Field>
            <Field label="Selling price (₹)"><Input inputMode="decimal" value={gen.price} onChange={(e) => setGen({ ...gen, price: e.target.value })} /></Field>
            <Field label="MRP (₹)"><Input inputMode="decimal" value={gen.mrp} onChange={(e) => setGen({ ...gen, mrp: e.target.value })} /></Field>
            <Field label="Weight (g)"><Input inputMode="numeric" value={gen.weight} onChange={(e) => setGen({ ...gen, weight: e.target.value })} /></Field>
          </div>
          <Button variant="secondary" onClick={generate}>Generate</Button>
        </section>
      )}

      <Problems error={error} />
      {note && <p role="status" className="text-sm text-success">{note}</p>}

      {locked && (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-lg">Variants ({p.variants.length})</h3>{canWrite && <Button onClick={saveGrid}>Save changes</Button>}</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="text-muted"><tr><th className="py-2">Variant</th><th>SKU</th><th>Price ₹</th><th>MRP ₹</th><th>Weight g</th><th>Barcode</th><th>Stock{wh ? ` (${wh.code})` : ""}</th><th>Active</th></tr></thead>
              <tbody>
                {p.variants.map((v) => {
                  const r = synced[v.id]!, cell = "min-h-9 w-24 rounded border border-line px-2 disabled:bg-soft";
                  return (
                    <tr key={v.id} className="border-t border-line">
                      <td className="py-2 pr-3 font-semibold">{label(v)}</td><td className="pr-3 text-muted">{v.sku}</td>
                      <td><input aria-label={`${v.sku} price`} className={cell} value={r.price} disabled={!canWrite} onChange={(e) => set(v.id, { price: e.target.value })} /></td>
                      <td><input aria-label={`${v.sku} MRP`} className={cell} value={r.mrp} disabled={!canWrite} onChange={(e) => set(v.id, { mrp: e.target.value })} /></td>
                      <td><input aria-label={`${v.sku} weight`} className={cell} value={r.weight} disabled={!canWrite} onChange={(e) => set(v.id, { weight: e.target.value })} /></td>
                      <td><input aria-label={`${v.sku} barcode`} className={`${cell} w-36`} value={r.barcode} disabled={!canWrite} onChange={(e) => set(v.id, { barcode: e.target.value })} /></td>
                      <td><input aria-label={`${v.sku} stock`} className={`${cell} ${Number(r.stock) === 0 ? "border-brand" : ""}`} value={r.stock} disabled={!canStock || !wh} onChange={(e) => set(v.id, { stock: e.target.value })} /></td>
                      <td><input type="checkbox" aria-label={`${v.sku} active`} className="size-4" checked={r.active} disabled={!canWrite} onChange={(e) => set(v.id, { active: e.target.checked })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
