"use client";
import { Badge, Button } from "@app/ui";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFeedback } from "@/components/feedback";
import { Card, Problems } from "@/components/form";
import { ApiError, del, get, post, type AttrDef, type Product, type Warehouse } from "@/lib/api";
import { can, useMe } from "@/lib/me";
import { General } from "./general";
import { Media } from "./media";
import { Related } from "./related";
import { Specs } from "./specs";
import { Variants } from "./variants";

const TABS = ["General", "Specs", "Options & Variants", "Media", "Related"] as const;

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const canWrite = can(me, "product:write");
  const [p, setP] = useState<Product | null>(null);
  const [defs, setDefs] = useState<AttrDef[]>([]);
  const [wh, setWh] = useState<Warehouse | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("General");
  const [error, setError] = useState<unknown>();

  const reload = useCallback(async () => {
    const prod = await get<Product>(`/admin/products/${id}`);
    setP(prod);
    setDefs(await get<AttrDef[]>(`/admin/categories/${prod.categoryId}/effective-attributes`).catch(() => []));
  }, [id]);

  useEffect(() => {
    reload().catch(setError);
    if (can(me, "warehouse:read")) get<Warehouse[]>("/admin/inventory/warehouses").then((w) => setWh(w[0] ?? null)).catch(() => undefined);
  }, [reload, me]);

  if (!p) return error ? <Problems error={error} /> : <p className="text-muted">Loading…</p>;

  const setStatus = async (status: Product["status"]) => {
    setError(undefined);
    try { setP(await post<Product>(`/admin/products/${id}/status`, { status })); } catch (e) { setError(e); if (e instanceof ApiError) setTab("General"); }
  };

  const duplicate = async () => {
    try { const c = await post<Product>(`/admin/products/${id}/duplicate`); toast("Duplicated as a draft. Add images before publishing."); router.push(`/products/${c.id}`); } catch (e) { setError(e); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete “${p.title}”?`, body: "It disappears from the store and the product list. Past orders keep their record.", confirmLabel: "Delete", danger: true }))) return;
    try { await del(`/admin/products/${id}`); toast("Product deleted"); router.push("/products"); } catch (e) { setError(e); }
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/products" className="underline">Products</Link> / {p.title}</nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h1 className="text-3xl">{p.title}</h1><Badge tone={p.status === "ACTIVE" ? "success" : "neutral"}>{p.status}</Badge></div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            {p.status === "ACTIVE" && <a href={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/p/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-sm px-4 text-sm font-semibold underline">View on store ↗</a>}
            <Button variant="ghost" onClick={duplicate}>Duplicate</Button>
            {p.status !== "ARCHIVED" && <Button variant="ghost" onClick={() => setStatus("ARCHIVED")}>Archive</Button>}
            <Button variant="ghost" className="!text-brand" onClick={remove}>Delete</Button>
            {p.status === "ACTIVE"
              ? <Button variant="ghost" onClick={() => setStatus("DRAFT")}>Unpublish</Button>
              : <Button variant="secondary" onClick={() => setStatus("ACTIVE")}>{p.status === "ARCHIVED" ? "Restore & publish" : "Publish"}</Button>}
          </div>
        )}
      </div>
      <Problems error={error} />
      <div role="tablist" aria-label="Product sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(undefined); }} className={`min-h-11 whitespace-nowrap px-4 text-sm ${tab === t ? "border-b-2 border-brand font-semibold" : "text-muted"}`}>{t}</button>)}
      </div>
      <Card>
        {tab === "General" && <General p={p} onSaved={setP} canWrite={canWrite} />}
        {tab === "Specs" && <Specs p={p} defs={defs} onSaved={setP} canWrite={canWrite} />}
        {tab === "Options & Variants" && <Variants p={p} wh={wh} onChange={setP} reload={reload} canWrite={canWrite} canStock={can(me, "inventory:write")} />}
        {tab === "Related" && <Related p={p} canWrite={canWrite} />}
        {tab === "Media" && <Media p={p} onChange={setP} reload={reload} canWrite={can(me, "media:write")} />}
      </Card>
    </div>
  );
}
