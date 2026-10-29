"use client";
import { Button } from "@app/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, Field, Input, Problems, Select } from "@/components/form";
import { useFeedback } from "@/components/feedback";
import { ApiError, del, get, post, put } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Pin = { pincode: string; city: string; state: string; codAllowed: boolean; etaDaysMin: number; etaDaysMax: number };

/** "699" or "699.50" → paise; unlike parseRupees this accepts 0 (free shipping fee). */
const toPaise = (s: string) => (/^\d+(\.\d{1,2})?$/.test(s.trim()) ? Math.round(parseFloat(s) * 100) : null);
const rupees = (p: number) => String(p / 100);

export default function Settings() {
  const me = useMe();
  const canWrite = can(me, "settings:write");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Settings</h1>
      <Shipping canWrite={canWrite} />
      <ReturnRules canWrite={canWrite} />
      <Business canWrite={canWrite} />
      <Pincodes canWrite={canWrite} />
    </div>
  );
}

function Shipping({ canWrite }: { canWrite: boolean }) {
  const { toast } = useFeedback();
  const [fee, setFee] = useState("");
  const [free, setFree] = useState("");
  const [error, setError] = useState<unknown>();

  useEffect(() => { get<{ flatPaise: number; freeAbovePaise: number }>("/admin/settings/shipping").then((s) => { setFee(rupees(s.flatPaise)); setFree(rupees(s.freeAbovePaise)); }).catch(setError); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const flatPaise = toPaise(fee), freeAbovePaise = toPaise(free);
    if (flatPaise === null || freeAbovePaise === null) return setError(new Error("Enter amounts in rupees, like 99 or 699.50"));
    try { await put("/admin/settings/shipping", { flatPaise, freeAbovePaise }); setError(undefined); toast("Shipping settings saved"); } catch (er) { setError(er); }
  }

  return (
    <Card title="Shipping">
      <form onSubmit={save} aria-label="Shipping" className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Field label="Shipping fee (₹)" hint="Charged when the order is below the free-shipping amount."><Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} disabled={!canWrite} required /></Field>
        <Field label="Free shipping above (₹)" hint="Also the first reward in the cart's progress bar."><Input inputMode="decimal" value={free} onChange={(e) => setFree(e.target.value)} disabled={!canWrite} required /></Field>
        <div className="sm:col-span-2 space-y-3"><Problems error={error} />{canWrite && <Button type="submit">Save shipping</Button>}</div>
      </form>
    </Card>
  );
}

function ReturnRules({ canWrite }: { canWrite: boolean }) {
  const { toast } = useFeedback();
  const [v, setV] = useState({ windowDays: "7", graceDays: "1", fee: "0" });
  const [error, setError] = useState<unknown>();
  useEffect(() => { get<{ windowDays: number; graceDays: number; pickupFeePaise: number }>("/admin/settings/returns").then((r) => setV({ windowDays: String(r.windowDays), graceDays: String(r.graceDays), fee: rupees(r.pickupFeePaise) })).catch(setError); }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    const pickupFeePaise = toPaise(v.fee);
    if (pickupFeePaise === null) return setError(new Error("Enter the pickup fee in rupees, like 0 or 99"));
    try { await put("/admin/settings/returns", { windowDays: Number(v.windowDays), graceDays: Number(v.graceDays), pickupFeePaise }); setError(undefined); toast("Return rules saved"); } catch (er) { setError(er); }
  }
  return (
    <Card title="Returns">
      <form onSubmit={save} aria-label="Returns" className="grid max-w-2xl gap-4 sm:grid-cols-3">
        <Field label="Return window (days)" hint="Counted from delivery."><Input type="number" min={0} max={60} value={v.windowDays} onChange={(e) => setV({ ...v, windowDays: e.target.value })} disabled={!canWrite} required /></Field>
        <Field label="Grace before closing (days)" hint="Then the order is closed."><Input type="number" min={0} max={14} value={v.graceDays} onChange={(e) => setV({ ...v, graceDays: e.target.value })} disabled={!canWrite} required /></Field>
        <Field label="Pickup fee for change of mind (₹)" hint="Deducted from the refund. 0 = free."><Input inputMode="decimal" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} disabled={!canWrite} required /></Field>
        <div className="sm:col-span-3 space-y-3"><Problems error={error} />{canWrite && <Button type="submit">Save return rules</Button>}</div>
      </form>
    </Card>
  );
}

function Business({ canWrite }: { canWrite: boolean }) {
  const { toast } = useFeedback();
  const [v, setV] = useState({ legalName: "", gstin: "", address: "", state: "", phone: "", email: "" });
  const [error, setError] = useState<unknown>();
  useEffect(() => { get<typeof v>("/admin/settings/business").then(setV).catch(setError); }, []);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  async function save(e: FormEvent) { e.preventDefault(); try { await put("/admin/settings/business", v); setError(undefined); toast("Business details saved"); } catch (er) { setError(er); } }
  return (
    <Card title="Business details (printed on invoices)">
      <form onSubmit={save} aria-label="Business details" className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Field label="Legal business name"><Input value={v.legalName} onChange={set("legalName")} disabled={!canWrite} /></Field>
        <Field label="GSTIN" hint="15 characters. Leave empty if not registered."><Input value={v.gstin} onChange={set("gstin")} disabled={!canWrite} maxLength={15} /></Field>
        <div className="sm:col-span-2"><Field label="Registered address"><Input value={v.address} onChange={set("address")} disabled={!canWrite} /></Field></div>
        <Field label="State" hint="Decides CGST+SGST or IGST."><Input value={v.state} onChange={set("state")} disabled={!canWrite} /></Field>
        <Field label="Phone"><Input value={v.phone} onChange={set("phone")} disabled={!canWrite} /></Field>
        <Field label="Email"><Input type="email" value={v.email} onChange={set("email")} disabled={!canWrite} /></Field>
        <div className="sm:col-span-2 space-y-3"><Problems error={error} />{canWrite && <Button type="submit">Save business details</Button>}</div>
      </form>
    </Card>
  );
}

const CSV_HELP = "pincode,city,state,cod,etaMin,etaMax\n110001,New Delhi,DL,yes,2,4";

function parseCsv(text: string): { rows: (Pin)[]; errors: string[] } {
  const rows: Pin[] = [], errors: string[] = [];
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const [pincode, city, state, cod, min, max] = line.split(",").map((x) => x.trim());
    if (i === 0 && /^pincode$/i.test(pincode ?? "")) return; // header
    const etaDaysMin = Number(min), etaDaysMax = Number(max);
    if (!/^[1-9]\d{5}$/.test(pincode ?? "") || !city || !state || !/^(yes|no)$/i.test(cod ?? "") || !Number.isInteger(etaDaysMin) || !Number.isInteger(etaDaysMax) || etaDaysMax < etaDaysMin) errors.push(`Line ${i + 1}: ${line.slice(0, 60)}`);
    else rows.push({ pincode: pincode!, city, state, codAllowed: cod!.toLowerCase() === "yes", etaDaysMin, etaDaysMax });
  });
  return { rows, errors };
}

function Pincodes({ canWrite }: { canWrite: boolean }) {
  const { toast, confirm } = useFeedback();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Pin[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();
  const [form, setForm] = useState({ pincode: "", city: "", state: "", codAllowed: "yes", etaDaysMin: "2", etaDaysMax: "5" });
  const [csv, setCsv] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const load = useCallback(async (cursor?: string) => {
    try {
      const p = new URLSearchParams({ limit: "50", ...(q && { q }), ...(cursor && { cursor }) });
      const r = await get<{ items: Pin[]; total: number; nextCursor: string | null }>(`/admin/pincodes?${p}`);
      setRows((o) => (cursor && o ? [...o, ...r.items] : r.items)); setTotal(r.total); setNext(r.nextCursor); setError(undefined);
    } catch (e) { setError(e); setRows((o) => o ?? []); }
  }, [q]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await put(`/admin/pincodes/${form.pincode}`, { city: form.city, state: form.state, codAllowed: form.codAllowed === "yes", etaDaysMin: Number(form.etaDaysMin), etaDaysMax: Number(form.etaDaysMax) });
      toast(`Pincode ${form.pincode} saved`); setForm({ ...form, pincode: "", city: "" }); void load();
    } catch (er) { setError(er); }
  }

  async function importCsv() {
    const { rows: parsed, errors } = parseCsv(csv);
    setCsvErrors(errors);
    if (errors.length || !parsed.length) return;
    try {
      let saved = 0;
      for (let i = 0; i < parsed.length; i += 1000) saved += (await post<{ saved: number }>("/admin/pincodes/import", { rows: parsed.slice(i, i + 1000) })).saved;
      toast(`${saved} pincodes imported`); setCsv(""); void load();
    } catch (er) { setError(er); }
  }

  async function remove(p: Pin) {
    if (!(await confirm({ title: `Remove pincode ${p.pincode}?`, body: "Customers there will no longer see delivery available.", confirmLabel: "Remove", danger: true }))) return;
    try { await del(`/admin/pincodes/${p.pincode}`); toast("Pincode removed"); void load(); } catch (e) { toast(e instanceof ApiError ? e.lines.join(" ") : "Failed", "error"); }
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Card title={`Serviceable pincodes${rows ? ` (${total})` : ""}`}>
      <Input placeholder="Search by pincode or city" aria-label="Search pincodes" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <Problems error={error} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Serviceable pincodes</caption>
          <thead className="text-muted"><tr><th scope="col" className="py-2">Pincode</th><th scope="col">City</th><th scope="col">State</th><th scope="col">COD</th><th scope="col">Delivery</th>{canWrite && <th scope="col" className="text-right">Actions</th>}</tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="py-3"><div className="h-8 animate-pulse rounded bg-soft" /></td></tr>}
            {rows?.map((p) => (
              <tr key={p.pincode} className="border-t border-line">
                <td className="py-2 font-mono">{p.pincode}</td><td>{p.city}</td><td>{p.state}</td><td>{p.codAllowed ? "Yes" : "No"}</td><td>{p.etaDaysMin}–{p.etaDaysMax} days</td>
                {canWrite && <td className="text-right"><button type="button" aria-label={`Remove ${p.pincode}`} onClick={() => remove(p)} className="min-h-11 text-brand underline">Remove</button></td>}
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">{q ? "No pincodes match." : "No pincodes yet. Add one below or import a CSV."}</td></tr>}
          </tbody>
        </table>
      </div>
      {next && <Button variant="ghost" onClick={() => void load(next)}>Load more</Button>}

      {canWrite && (
        <>
          <form onSubmit={add} aria-label="Add pincode" className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Pincode"><Input value={form.pincode} onChange={set("pincode")} inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" required /></Field>
            <Field label="City"><Input value={form.city} onChange={set("city")} required /></Field>
            <Field label="State"><Input value={form.state} onChange={set("state")} required /></Field>
            <Field label="COD"><Select value={form.codAllowed} onChange={set("codAllowed")}><option value="yes">Yes</option><option value="no">No</option></Select></Field>
            <Field label="Min days"><Input value={form.etaDaysMin} onChange={set("etaDaysMin")} inputMode="numeric" required /></Field>
            <Field label="Max days"><Input value={form.etaDaysMax} onChange={set("etaDaysMax")} inputMode="numeric" required /></Field>
            <div className="sm:col-span-3 lg:col-span-6"><Button type="submit">Add or update pincode</Button></div>
          </form>
          <div className="space-y-2 border-t border-line pt-4">
            <Field label="Bulk import (CSV)" hint={`One pincode per line: ${CSV_HELP.split("\n")[0]}. Existing pincodes are updated.`}>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder={CSV_HELP} className="w-full rounded-lg border border-line bg-white p-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-brand" />
            </Field>
            {csvErrors.length > 0 && <div role="alert" className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm text-brand"><ul className="space-y-1">{csvErrors.slice(0, 5).map((l) => <li key={l}>{l}</li>)}{csvErrors.length > 5 && <li>…and {csvErrors.length - 5} more</li>}</ul></div>}
            <Button variant="secondary" onClick={importCsv} disabled={!csv.trim()}>Import</Button>
          </div>
        </>
      )}
    </Card>
  );
}
