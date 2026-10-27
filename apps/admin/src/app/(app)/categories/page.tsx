"use client";
import { Badge, Button } from "@app/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, Field, Input, Problems, Select } from "@/components/form";
import { del, flattenCategories, get, patch, post, type AttrDef, type Category } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Flat = ReturnType<typeof flattenCategories>[number];

export default function Categories() {
  const me = useMe();
  const canWrite = can(me, "category:write"), canAttr = can(me, "attribute:write");
  const [flat, setFlat] = useState<Flat[]>([]);
  const [sel, setSel] = useState<Flat | null>(null);
  const [attrs, setAttrs] = useState<AttrDef[]>([]);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => setFlat(flattenCategories(await get<Category[]>("/admin/categories"))), []);
  useEffect(() => { load().catch(setError); }, [load]);
  useEffect(() => { if (sel) get<AttrDef[]>(`/admin/categories/${sel.id}/attributes`).then(setAttrs).catch(setError); }, [sel]);

  const run = async (fn: () => Promise<unknown>) => { setError(undefined); try { await fn(); await load(); } catch (e) { setError(e); } };

  const createCat = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    void run(async () => { await post("/admin/categories", { name: f.get("name"), ...(f.get("parentId") ? { parentId: f.get("parentId") } : {}) }); form.reset(); });
  };

  const addAttr = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sel) return;
    const form = e.currentTarget, f = new FormData(form);
    const label = String(f.get("label"));
    void run(async () => {
      await post(`/admin/categories/${sel.id}/attributes`, {
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""), label, type: f.get("type"),
        enumValues: String(f.get("values")).split(",").map((s) => s.trim()).filter(Boolean),
        isFilterable: f.get("filterable") === "on", isRequired: f.get("required") === "on",
      });
      form.reset(); setAttrs(await get<AttrDef[]>(`/admin/categories/${sel.id}/attributes`));
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Categories</h1>
      <Problems error={error} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tree">
          <ul className="space-y-1 text-sm">
            {flat.map((c) => (
              <li key={c.id} style={{ paddingLeft: c.depth * 20 }}>
                <button onClick={() => setSel(c)} aria-pressed={sel?.id === c.id} className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-soft ${sel?.id === c.id ? "bg-soft font-semibold" : ""}`}>
                  <span>{c.name} {!c.isActive && <Badge>Hidden</Badge>}</span><span className="text-muted">{c.productCount}</span>
                </button>
              </li>
            ))}
          </ul>
          {canWrite && (
            <form onSubmit={createCat} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="New category"><Input name="name" required /></Field>
              <Field label="Parent"><Select name="parentId" defaultValue=""><option value="">(top level)</option>{flat.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>)}</Select></Field>
              <Button type="submit" className="self-end">Add</Button>
            </form>
          )}
        </Card>

        <Card title={sel ? `${sel.name}` : "Select a category"}>
          {sel && (
            <>
              <div className="flex flex-wrap gap-3">
                {canWrite && <Button variant="ghost" onClick={() => run(async () => { await patch(`/admin/categories/${sel.id}`, { isActive: !sel.isActive }); setSel({ ...sel, isActive: !sel.isActive }); })}>{sel.isActive ? "Hide from store" : "Show in store"}</Button>}
                {canWrite && <Button variant="ghost" onClick={() => run(async () => { await del(`/admin/categories/${sel.id}`); setSel(null); })}>Delete</Button>}
              </div>
              <h3 className="text-base font-semibold">Specification fields</h3>
              <p className="text-xs text-muted">Sub-categories inherit these. Filterable fields become storefront filters.</p>
              <ul className="divide-y divide-line text-sm">
                {attrs.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <span>{a.label} <span className="text-muted">· {a.type}{a.enumValues.length ? ` (${a.enumValues.join(", ")})` : ""}{a.isRequired ? " · required" : ""}</span></span>
                    {canAttr && <button className="text-brand underline" onClick={() => run(async () => { await del(`/admin/attributes/${a.id}`); setAttrs(attrs.filter((x) => x.id !== a.id)); })}>Remove</button>}
                  </li>
                ))}
                {attrs.length === 0 && <li className="py-2 text-muted">None defined here.</li>}
              </ul>
              {canAttr && (
                <form onSubmit={addAttr} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                  <Field label="Label"><Input name="label" required placeholder="Thermal performance" /></Field>
                  <Field label="Type"><Select name="type" defaultValue="TEXT"><option>TEXT</option><option>NUMBER</option><option>ENUM</option><option>BOOLEAN</option></Select></Field>
                  <Field label="Choices (for ENUM)" hint="Comma separated"><Input name="values" /></Field>
                  <div className="flex items-end gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="filterable" className="size-4" />Filterable</label><label className="flex items-center gap-2"><input type="checkbox" name="required" className="size-4" />Required</label></div>
                  <Button type="submit">Add field</Button>
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
