"use client";
import { Button } from "@app/ui";
import { useState, type FormEvent } from "react";
import { Field, Input, Problems, Select } from "@/components/form";
import { patch, type AttrDef, type Product } from "@/lib/api";

export function Specs({ p, defs, onSaved, canWrite }: { p: Product; defs: AttrDef[]; onSaved: (p: Product) => void; canWrite: boolean }) {
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const attributes: Record<string, unknown> = {};
    for (const d of defs) {
      const raw = f.get(d.key);
      if (d.type === "BOOLEAN") attributes[d.key] = raw === "on";
      else if (raw !== null && raw !== "") attributes[d.key] = d.type === "NUMBER" ? Number(raw) : raw;
    }
    setError(undefined); setSaved(false);
    try { onSaved(await patch<Product>(`/admin/products/${p.id}`, { attributes })); setSaved(true); } catch (err) { setError(err); }
  }

  if (defs.length === 0) return <p className="text-muted">This category has no specification fields yet. Add them under Categories.</p>;
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <p className="text-sm text-muted">Fields come from the category. Required ones must be filled before publishing.</p>
      <fieldset disabled={!canWrite} className="grid gap-4 sm:grid-cols-2">
        {defs.map((d) => {
          const v = p.attributes[d.key];
          const label = `${d.label}${d.unit ? ` (${d.unit})` : ""}${d.isRequired ? " *" : ""}`;
          return d.type === "BOOLEAN"
            ? <label key={d.key} className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name={d.key} defaultChecked={v === true} className="size-4" />{label}</label>
            : <Field key={d.key} label={label}>
                {d.type === "ENUM"
                  ? <Select name={d.key} defaultValue={(v as string) ?? ""}><option value="">—</option>{d.enumValues.map((x) => <option key={x}>{x}</option>)}</Select>
                  : <Input name={d.key} type={d.type === "NUMBER" ? "number" : "text"} step="any" defaultValue={(v as string | number | undefined) ?? ""} />}
              </Field>;
        })}
      </fieldset>
      <Problems error={error} />
      {canWrite && <div className="flex items-center gap-3"><Button type="submit">Save specs</Button>{saved && <span role="status" className="text-sm text-success">Saved</span>}</div>}
    </form>
  );
}
