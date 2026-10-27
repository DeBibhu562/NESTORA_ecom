"use client";
import { Button } from "@app/ui";
import { useCallback, useEffect, useState } from "react";
import { Card, Input, Problems } from "@/components/form";
import { get, post, type Warehouse } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Low = { variantId: string; sku: string; title: string; onHand: number; reserved: number; lowStockAt: number };

export default function Inventory() {
  const me = useMe();
  const canWrite = can(me, "inventory:write");
  const [rows, setRows] = useState<Low[]>([]);
  const [wh, setWh] = useState<Warehouse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => setRows(await get<Low[]>("/admin/inventory/low-stock?limit=100")), []);
  useEffect(() => { load().catch(setError); get<Warehouse[]>("/admin/inventory/warehouses").then((w) => setWh(w[0] ?? null)).catch(() => undefined); }, [load]);

  const save = async (r: Low) => {
    const n = Number(draft[r.variantId]);
    if (!wh || !Number.isInteger(n) || n < 0) return setError(new Error("Enter a whole number, 0 or more"));
    setError(undefined);
    try { await post("/admin/inventory/adjust", { variantId: r.variantId, warehouseId: wh.id, reason: "ADJUST", setOnHand: n }); setDraft(({ [r.variantId]: _, ...rest }) => rest); await load(); } catch (e) { setError(e); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Inventory</h1>
      <Problems error={error} />
      <Card title="Low or out of stock">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-muted"><tr><th className="py-2">Product</th><th>SKU</th><th>On hand</th><th>Reserved</th><th>Available</th>{canWrite && <th>Set on hand</th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.variantId} className="border-t border-line">
                  <td className="py-2 pr-3">{r.title}</td><td className="pr-3 text-muted">{r.sku}</td><td>{r.onHand}</td><td>{r.reserved}</td>
                  <td className={r.onHand - r.reserved <= 0 ? "font-semibold text-brand" : ""}>{r.onHand - r.reserved}</td>
                  {canWrite && <td className="flex gap-2 py-1"><Input aria-label={`${r.sku} new stock`} className="w-24" inputMode="numeric" value={draft[r.variantId] ?? ""} onChange={(e) => setDraft({ ...draft, [r.variantId]: e.target.value })} /><Button variant="ghost" onClick={() => save(r)}>Save</Button></td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">Everything is well stocked.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Use a product's Variants tab to edit stock for all of its variants at once. Every change is recorded in the stock ledger.</p>
      </Card>
    </div>
  );
}
