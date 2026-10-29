"use client";
import { formatPaise } from "@app/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Problems } from "@/components/form";
import { get } from "@/lib/api";

type Inv = {
  invoiceNumber: string; orderNumber: string; date: string; intraState: boolean; shippingPaise: number; discountPaise: number;
  seller: { legalName: string; gstin: string; address: string; state: string; phone: string; email: string };
  buyer: { name?: string; line1?: string; line2?: string; city?: string; state?: string; pincode?: string; phone: string };
  lines: { title: string; variantTitle: string; hsnCode: string; gstRateBp: number; qty: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number }[];
  totals: { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number };
};

export default function Invoice() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<Inv | null>(null);
  const [error, setError] = useState<unknown>();
  useEffect(() => { get<Inv>(`/admin/orders/${id}/invoice`).then(setInv).catch(setError); }, [id]);
  if (!inv) return <Problems error={error} />;
  const t = inv.totals;
  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm shadow-card print:shadow-none">
      <div className="flex items-start justify-between">
        <div><h1 className="text-2xl">Tax invoice</h1><p className="text-muted">{inv.invoiceNumber} · {new Date(inv.date).toLocaleDateString("en-IN", { dateStyle: "long" })}</p><p className="text-muted">Order {inv.orderNumber}</p></div>
        <button onClick={() => window.print()} className="min-h-10 rounded-sm bg-navy px-4 text-sm font-semibold text-white print:hidden">Print / save as PDF</button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><p className="font-semibold">Sold by</p><p>{inv.seller.legalName || <span className="text-brand">Add your business details in Settings</span>}</p><p className="whitespace-pre-line text-muted">{inv.seller.address}</p>{inv.seller.gstin && <p>GSTIN {inv.seller.gstin}</p>}</div>
        <div><p className="font-semibold">Billed and shipped to</p><p>{inv.buyer.name}</p><p className="text-muted">{inv.buyer.line1}{inv.buyer.line2 && `, ${inv.buyer.line2}`}<br />{inv.buyer.city}, {inv.buyer.state} {inv.buyer.pincode}<br />{inv.buyer.phone}</p></div>
      </div>
      <table className="w-full text-left"><thead className="border-y border-line text-xs uppercase text-muted"><tr><th className="py-2">Item</th><th>HSN</th><th>Qty</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Total</th></tr></thead>
        <tbody>{inv.lines.map((l, i) => <tr key={i} className="border-b border-line"><td className="py-2">{l.title}<br /><span className="text-xs text-muted">{l.variantTitle}</span></td><td>{l.hsnCode}</td><td>{l.qty}</td><td className="text-right">{formatPaise(l.taxablePaise)}</td><td className="text-right">{l.gstRateBp / 100}%<br /><span className="text-xs text-muted">{inv.intraState ? `CGST ${formatPaise(l.cgstPaise)} · SGST ${formatPaise(l.sgstPaise)}` : `IGST ${formatPaise(l.igstPaise)}`}</span></td><td className="text-right">{formatPaise(l.totalPaise)}</td></tr>)}</tbody></table>
      <div className="ml-auto max-w-xs space-y-1">
        <p className="flex justify-between"><span>Taxable value</span><span>{formatPaise(t.taxablePaise)}</span></p>
        {inv.intraState ? <><p className="flex justify-between"><span>CGST</span><span>{formatPaise(t.cgstPaise)}</span></p><p className="flex justify-between"><span>SGST</span><span>{formatPaise(t.sgstPaise)}</span></p></> : <p className="flex justify-between"><span>IGST</span><span>{formatPaise(t.igstPaise)}</span></p>}
        {inv.shippingPaise > 0 && <p className="flex justify-between"><span>Shipping</span><span>{formatPaise(inv.shippingPaise)}</span></p>}
        <p className="flex justify-between border-t border-line pt-1 text-lg font-bold"><span>Total</span><span>{formatPaise(t.totalPaise)}</span></p>
      </div>
      <p className="text-xs text-muted">Prices are inclusive of GST. This is a computer-generated invoice.</p>
    </div>
  );
}
