"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/form";
import { get } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Low = { variantId: string; sku: string; title: string; onHand: number; reserved: number };

export default function Dashboard() {
  const me = useMe();
  const [low, setLow] = useState<Low[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (can(me, "inventory:read")) get<Low[]>("/admin/inventory/low-stock?limit=10").then(setLow).catch(() => setLow([]));
    if (can(me, "product:read"))
      for (const s of ["ACTIVE", "DRAFT"]) get<{ items: unknown[] }>(`/admin/products?status=${s}&limit=100`).then((r) => setCounts((c) => ({ ...c, [s]: r.items.length })));
  }, [me]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Welcome, {me.name}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Active products"><p className="text-3xl font-semibold">{counts.ACTIVE ?? "–"}</p></Card>
        <Card title="Drafts"><p className="text-3xl font-semibold">{counts.DRAFT ?? "–"}</p></Card>
        <Card title="Low stock"><p className="text-3xl font-semibold">{low?.length ?? "–"}</p></Card>
      </div>
      {low && low.length > 0 && (
        <Card title="Needs restocking">
          <ul className="divide-y divide-line text-sm">
            {low.map((l) => <li key={l.variantId} className="flex justify-between py-2"><span>{l.title} <span className="text-muted">({l.sku})</span></span><span className={l.onHand - l.reserved <= 0 ? "font-semibold text-brand" : ""}>{l.onHand - l.reserved} available</span></li>)}
          </ul>
          <Link href="/inventory" className="text-sm underline">Manage inventory</Link>
        </Card>
      )}
    </div>
  );
}
