"use client";
import { Button } from "@app/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Card, Field, Input, Problems, Select } from "@/components/form";
import { OptionsEditor, toPayload, type OptionDraft } from "@/components/options-editor";
import { flattenCategories, get, post, type Category, type Product } from "@/lib/api";
import { GST_SLABS } from "@/lib/constants";


export default function NewProduct() {
  const router = useRouter();
  const [cats, setCats] = useState<ReturnType<typeof flattenCategories>>([]);
  const [options, setOptions] = useState<OptionDraft[]>([{ name: "Capacity", displayAs: "PILL", values: "" }, { name: "Colour", displayAs: "SWATCH", values: "" }]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  useEffect(() => { get<Category[]>("/admin/categories").then((t) => setCats(flattenCategories(t).filter((c) => c.isActive))); }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(undefined);
    try {
      const p = await post<Product>("/admin/products", {
        title: f.get("title"), categoryId: f.get("categoryId"), hsnCode: f.get("hsnCode"), gstRateBp: Number(f.get("gst")), options: toPayload(options),
      });
      router.replace(`/products/${p.id}`);
    } catch (err) { setError(err); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <h1 className="text-3xl">New product</h1>
      <Card title="Basics">
        <Field label="Title"><Input name="title" required minLength={2} maxLength={160} autoFocus /></Field>
        <Field label="Category"><Select name="categoryId" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>)}
        </Select></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="HSN code" hint="4–8 digits; confirm with your CA"><Input name="hsnCode" required pattern="\d{4,8}" defaultValue="7323" /></Field>
          <Field label="GST rate"><Select name="gst" defaultValue="1800">{GST_SLABS.map((b) => <option key={b} value={b}>{b / 100}%</option>)}</Select></Field>
        </div>
      </Card>
      <Card title="Options"><p className="text-sm text-muted">The choices a shopper picks (up to 3). Variants are generated from these on the next screen.</p><OptionsEditor value={options} onChange={setOptions} /></Card>
      <Problems error={error} />
      <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create draft"}</Button>
    </form>
  );
}
