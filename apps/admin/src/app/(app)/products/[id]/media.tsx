"use client";
import { Button } from "@app/ui";
import { useState, type FormEvent } from "react";
import { Field, Input, Problems, Select } from "@/components/form";
import { del, post, type Product } from "@/lib/api";

export function Media({ p, reload, canWrite }: { p: Product; onChange: (p: Product) => void; reload: () => Promise<void>; canWrite: boolean }) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const colourOption = p.options.find((o) => o.displayAs === "SWATCH") ?? p.options[0];
  const nameOf = (id: string | null) => p.options.flatMap((o) => o.values).find((v) => v.id === id)?.value;

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    if (!f.get("optionValueId")) f.delete("optionValueId");
    setBusy(true); setError(undefined);
    try { await post(`/admin/products/${p.id}/media`, f); form.reset(); await reload(); } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <form onSubmit={upload} className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <Field label="Image" hint="JPEG, PNG, WebP or AVIF, up to 5 MB"><Input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required /></Field>
          <Field label="Alt text" hint="Describe the image for screen readers"><Input name="alt" required minLength={3} maxLength={200} placeholder="Pink bottle, front view" /></Field>
          {colourOption && <Field label={`Show for ${colourOption.name}`} hint="Leave empty for all"><Select name="optionValueId" defaultValue=""><option value="">All</option>{colourOption.values.map((v) => <option key={v.id} value={v.id}>{v.value}</option>)}</Select></Field>}
          <div className="self-end"><Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button></div>
        </form>
      )}
      <Problems error={error} />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {p.media.map((m) => (
          <li key={m.id} className="space-y-1 rounded-xl border border-line p-2 text-xs">
            <img src={m.url} alt={m.alt} className="aspect-square w-full rounded bg-soft object-cover" />
            <p className="truncate" title={m.alt}>{m.alt}</p>
            <p className="text-muted">{nameOf(m.optionValueId) ?? "All"}</p>
            {canWrite && <button className="text-brand underline" onClick={async () => { try { await del(`/admin/media/${m.id}`); await reload(); } catch (e) { setError(e); } }}>Delete</button>}
          </li>
        ))}
        {p.media.length === 0 && <li className="col-span-full text-muted">No images yet. At least one is required to publish.</li>}
      </ul>
    </div>
  );
}
