"use client";
import { Button } from "@app/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, Field, Input, Problems, Select } from "@/components/form";
import { useFeedback } from "@/components/feedback";
import { ApiError, del, get, post, put } from "@/lib/api";
import { can, useMe } from "@/lib/me";

type Coupon = { code: string; type: "PERCENT" | "FLAT" | "FREE_SHIPPING"; valueBp: number | null; valuePaise: number | null; maxDiscountPaise: number | null; minSubtotalPaise: number; usageLimit: number | null; usedCount: number; endsAt: string | null; isActive: boolean; paymentMethods: string[] };
type Milestone = { id: string; label: string; thresholdPaise: number; position: number; rewardType: string; valuePaise: number | null; isActive: boolean };

const toPaise = (s: string) => (/^\d+(\.\d{1,2})?$/.test(s.trim()) ? Math.round(parseFloat(s) * 100) : null);
const inr = (p: number) => `₹${p / 100}`;
const describe = (c: Coupon) => (c.type === "PERCENT" ? `${(c.valueBp ?? 0) / 100}% off` : c.type === "FLAT" ? `${inr(c.valuePaise ?? 0)} off` : "Free shipping");

export default function Offers() {
  const canWrite = can(useMe(), "settings:write");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Offers</h1>
      <Coupons canWrite={canWrite} />
      <Milestones canWrite={canWrite} />
    </div>
  );
}

function Coupons({ canWrite }: { canWrite: boolean }) {
  const { toast } = useFeedback();
  const [rows, setRows] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<unknown>();
  const [f, setF] = useState({ code: "", type: "PERCENT", value: "", max: "", min: "", limit: "" });
  const load = useCallback(() => get<Coupon[]>("/admin/coupons").then(setRows).catch((e) => { setError(e); setRows([]); }), []);
  useEffect(() => { void load(); }, [load]);

  const body = (c: Pick<Coupon, "type" | "valueBp" | "valuePaise" | "maxDiscountPaise" | "minSubtotalPaise" | "usageLimit" | "endsAt" | "isActive">) => c;

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = toPaise(f.value), max = f.max ? toPaise(f.max) : null, min = f.min ? toPaise(f.min) : 0;
    if ((f.type !== "FREE_SHIPPING" && value === null) || (f.max && max === null) || min === null) return setError(new Error("Enter amounts as numbers, like 150 or 99.50"));
    try {
      await put(`/admin/coupons/${f.code.toUpperCase()}`, body({
        type: f.type as Coupon["type"], valueBp: f.type === "PERCENT" ? value : null, valuePaise: f.type === "FLAT" ? value : null,
        maxDiscountPaise: f.type === "PERCENT" ? max : null, minSubtotalPaise: min, usageLimit: f.limit ? Number(f.limit) : null, endsAt: null, isActive: true,
      }));
      toast(`Coupon ${f.code.toUpperCase()} saved`); setError(undefined); setF({ ...f, code: "", value: "" }); void load();
    } catch (er) { setError(er); }
  }

  async function toggle(c: Coupon) {
    try { await put(`/admin/coupons/${c.code}`, body({ ...c, isActive: !c.isActive })); void load(); } catch (e) { toast(e instanceof ApiError ? e.lines.join(" ") : "Failed", "error"); }
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Coupons">
      <Problems error={error} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Coupons</caption>
          <thead className="text-muted"><tr><th scope="col" className="py-2">Code</th><th scope="col">Offer</th><th scope="col">Minimum</th><th scope="col">Used</th><th scope="col">Status</th>{canWrite && <th scope="col" className="text-right">Actions</th>}</tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="py-3"><div className="h-8 animate-pulse rounded bg-soft" /></td></tr>}
            {rows?.map((c) => (
              <tr key={c.code} className="border-t border-line">
                <td className="py-2 font-mono">{c.code}</td>
                <td>{describe(c)}{c.paymentMethods.length > 0 && <span className="text-muted"> · {c.paymentMethods.join("/")} at checkout</span>}</td>
                <td>{c.minSubtotalPaise ? inr(c.minSubtotalPaise) : "None"}</td>
                <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td>{c.isActive ? "Active" : "Off"}</td>
                {canWrite && <td className="text-right"><button type="button" onClick={() => toggle(c)} className="min-h-11 underline" aria-label={`${c.isActive ? "Turn off" : "Turn on"} ${c.code}`}>{c.isActive ? "Turn off" : "Turn on"}</button></td>}
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {canWrite && (
        <form onSubmit={add} aria-label="Add coupon" className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Code"><Input value={f.code} onChange={set("code")} pattern="[A-Za-z0-9]{3,20}" required /></Field>
          <Field label="Type"><Select value={f.type} onChange={set("type")}><option value="PERCENT">Percent off</option><option value="FLAT">Flat ₹ off</option><option value="FREE_SHIPPING">Free shipping</option></Select></Field>
          {f.type !== "FREE_SHIPPING" && <Field label={f.type === "PERCENT" ? "Percent (%)" : "Amount (₹)"}><Input inputMode="decimal" value={f.value} onChange={set("value")} required /></Field>}
          {f.type === "PERCENT" && <Field label="Max discount (₹)" hint="Optional"><Input inputMode="decimal" value={f.max} onChange={set("max")} /></Field>}
          <Field label="Minimum cart (₹)" hint="Optional"><Input inputMode="decimal" value={f.min} onChange={set("min")} /></Field>
          <Field label="Usage limit" hint="Optional"><Input inputMode="numeric" value={f.limit} onChange={set("limit")} /></Field>
          <div className="sm:col-span-3 lg:col-span-6"><Button type="submit">Save coupon</Button></div>
        </form>
      )}
    </Card>
  );
}

function Milestones({ canWrite }: { canWrite: boolean }) {
  const { toast, confirm } = useFeedback();
  const [rows, setRows] = useState<Milestone[] | null>(null);
  const [error, setError] = useState<unknown>();
  const [f, setF] = useState({ label: "", threshold: "", type: "DISCOUNT", value: "" });
  const load = useCallback(() => get<Milestone[]>("/admin/milestones").then(setRows).catch((e) => { setError(e); setRows([]); }), []);
  useEffect(() => { void load(); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const thresholdPaise = toPaise(f.threshold), valuePaise = f.type === "DISCOUNT" ? toPaise(f.value) : null;
    if (thresholdPaise === null || (f.type === "DISCOUNT" && valuePaise === null)) return setError(new Error("Enter amounts as numbers, like 1999"));
    try {
      await post("/admin/milestones", { label: f.label, thresholdPaise, rewardType: f.type, valuePaise, position: (rows?.at(-1)?.position ?? 0) + 1, isActive: true });
      toast("Milestone added"); setError(undefined); setF({ ...f, label: "", threshold: "", value: "" }); void load();
    } catch (er) { setError(er); }
  }

  async function remove(m: Milestone) {
    if (!(await confirm({ title: `Remove "${m.label}"?`, body: "It disappears from every customer's cart progress bar.", confirmLabel: "Remove", danger: true }))) return;
    try { await del(`/admin/milestones/${m.id}`); toast("Milestone removed"); void load(); } catch (e) { toast(e instanceof ApiError ? e.lines.join(" ") : "Failed", "error"); }
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Cart milestones">
      <p className="text-sm text-muted">Rewards customers unlock as their cart grows. The free-shipping amount is also set under Settings.</p>
      <Problems error={error} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <caption className="sr-only">Cart milestones</caption>
          <thead className="text-muted"><tr><th scope="col" className="py-2">Spend</th><th scope="col">Reward</th><th scope="col">Type</th>{canWrite && <th scope="col" className="text-right">Actions</th>}</tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={4} className="py-3"><div className="h-8 animate-pulse rounded bg-soft" /></td></tr>}
            {rows?.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="py-2">{inr(m.thresholdPaise)}</td><td>{m.label}</td>
                <td>{m.rewardType === "DISCOUNT" ? `${inr(m.valuePaise ?? 0)} off` : m.rewardType === "FREE_SHIPPING" ? "Free shipping" : m.rewardType === "COIN_DRAW" ? "Lucky draw" : "Gift"}</td>
                {canWrite && <td className="text-right"><button type="button" aria-label={`Remove ${m.label}`} onClick={() => remove(m)} className="min-h-11 text-brand underline">Remove</button></td>}
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">No milestones yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {canWrite && (
        <form onSubmit={add} aria-label="Add milestone" className="grid gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Field label="Label"><Input value={f.label} onChange={set("label")} maxLength={60} required /></Field>
          <Field label="Cart value (₹)"><Input inputMode="decimal" value={f.threshold} onChange={set("threshold")} required /></Field>
          <Field label="Reward"><Select value={f.type} onChange={set("type")}><option value="DISCOUNT">₹ off</option><option value="FREE_SHIPPING">Free shipping</option><option value="COIN_DRAW">Lucky draw</option></Select></Field>
          {f.type === "DISCOUNT" && <Field label="Discount (₹)"><Input inputMode="decimal" value={f.value} onChange={set("value")} required /></Field>}
          <div className="sm:col-span-4"><Button type="submit">Add milestone</Button></div>
        </form>
      )}
    </Card>
  );
}
