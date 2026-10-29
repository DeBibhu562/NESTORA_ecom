"use client";
import { Button } from "@app/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useFeedback } from "@/components/feedback";
import { Card, Field, Input, Problems } from "@/components/form";
import { del, get, post, put } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Banner = { id: string; title: string | null; subtitle: string | null; ctaLabel: string | null; imageUrl: string; link: string | null; position: number; isActive: boolean };
const blank = { title: "", subtitle: "", ctaLabel: "Shop now", imageUrl: "", link: "/c/bottles", position: 1, isActive: true };

export default function Banners() {
  const me = useMe();
  const canWrite = can(me, "banner:write");
  const { toast, confirm } = useFeedback();
  const [rows, setRows] = useState<Banner[] | null>(null);
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => get<Banner[]>("/admin/banners").then(setRows).catch(setError), []);
  useEffect(() => { void load(); }, [load]);

  async function pick(file: File | undefined) {
    if (!file) return;
    const f = new FormData(); f.set("file", file);
    try { const r = await post<{ url: string }>("/admin/banners/image", f); setForm((x) => x && { ...x, imageUrl: r.url }); } catch (e) { setError(e); }
  }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!form) return;
    setBusy(true); setError(undefined);
    const { id, ...b } = form;
    const body = { ...b, subtitle: b.subtitle || null, ctaLabel: b.ctaLabel || null, link: b.link || null, position: Number(b.position) };
    try { await (id ? put(`/admin/banners/${id}`, body) : post("/admin/banners", body)); toast("Slide saved"); setForm(null); void load(); } catch (err) { setError(err); } finally { setBusy(false); }
  }
  async function remove(b: Banner) {
    if (!(await confirm({ title: `Delete “${b.title}”?`, confirmLabel: "Delete", danger: true }))) return;
    try { await del(`/admin/banners/${b.id}`); toast("Slide deleted"); void load(); } catch (err) { setError(err); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl">Homepage slides</h1><p className="text-sm text-muted">Shown at the top of the store. With no live slides, the default hero is used.</p></div>
        {canWrite && !form && <Button onClick={() => setForm({ ...blank, position: (rows?.length ?? 0) + 1 })}>New slide</Button>}
      </div>
      <Problems error={error} />
      {form && (
        <Card title={form.id ? "Edit slide" : "New slide"}>
          <form onSubmit={save} className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <Field label="Headline"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={80} /></Field>
            <Field label="Button text"><Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} maxLength={30} /></Field>
            <div className="sm:col-span-2"><Field label="Subtitle"><Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} maxLength={160} /></Field></div>
            <Field label="Link" hint="A page on your store, e.g. /c/bottles/vacuum"><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></Field>
            <Field label="Order"><Input type="number" min={1} max={50} value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} /></Field>
            <div className="sm:col-span-2 space-y-2">
              <Field label="Image" hint="Wide image, about 1600×600. JPEG, PNG, WebP or AVIF, up to 5 MB."><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => void pick(e.target.files?.[0])} className="text-sm" /></Field>
              {form.imageUrl && <img src={form.imageUrl} alt="" className="h-32 rounded-xl object-cover" />}
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="size-4" />Show on the store</label>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy || !form.imageUrl}>{busy ? "Saving…" : "Save slide"}</Button><Button type="button" variant="ghost" onClick={() => { setForm(null); setError(undefined); }}>Cancel</Button></div>
          </form>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {rows?.map((b) => (
          <article key={b.id} className="overflow-hidden rounded-2xl bg-white shadow-card">
            <img src={b.imageUrl} alt="" className="h-40 w-full object-cover" />
            <div className="flex items-start justify-between gap-3 p-4">
              <div><p className="font-semibold">{b.title}</p><p className="text-sm text-muted">{b.subtitle}</p><p className="mt-1 text-xs text-muted">#{b.position} · {b.isActive ? <span className="font-semibold text-success">Live</span> : "Hidden"} · {b.link}</p></div>
              {canWrite && <div className="flex shrink-0 gap-3 text-sm"><button className="min-h-11 underline" onClick={() => setForm({ id: b.id, title: b.title ?? "", subtitle: b.subtitle ?? "", ctaLabel: b.ctaLabel ?? "", imageUrl: b.imageUrl, link: b.link ?? "", position: b.position, isActive: b.isActive })}>Edit</button><button className="min-h-11 text-brand underline" onClick={() => remove(b)}>Delete</button></div>}
            </div>
          </article>
        ))}
        {rows?.length === 0 && !form && <p className="rounded-2xl bg-white p-8 text-center text-muted shadow-card md:col-span-2">No slides yet. Add one to replace the default hero.</p>}
      </div>
    </div>
  );
}
