"use client";
import { formatPaise } from "@app/ui";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

type Inv = {
  invoiceNumber: string; orderNumber: string; date: string; intraState: boolean; shippingPaise: number;
  seller: { legalName: string; gstin: string; address: string; phone: string; email: string };
  buyer: { name?: string; line1?: string; line2?: string; city?: string; state?: string; pincode?: string; phone: string };
  lines: { title: string; variantTitle: string; hsnCode: string; gstRateBp: number; qty: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number }[];
  totals: { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number };
};

export default function Invoice() {
  const { publicId } = useParams<{ publicId: string }>();
  const [inv, setInv] = useState<Inv | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`${API}/orders/${publicId}/invoice`).then(async (r) => (r.ok ? setInv(await r.json()) : setError((await r.json().catch(() => null))?.title ?? "Invoice not available"))); }, [publicId]);
  if (!inv) return <main className="mx-auto max-w-2xl p-8">{error ? <p role="alert">{error}</p> : <div className="h-40 animate-pulse bg-soft" />}<Link href={`/order/${publicId}`} className="mt-3 inline-block underline">Back to your order</Link></main>;
  const t = inv.totals;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm">
      <div className="flex items-start justify-between"><div><h1 className="text-2xl">Tax invoice</h1><p className="text-muted">{inv.invoiceNumber} · {new Date(inv.date).toLocaleDateString("en-IN", { dateStyle: "long" })} · Order {inv.orderNumber}</p></div><button onClick={() => window.print()} className="min-h-10 rounded-sm bg-navy px-4 font-semibold text-white print:hidden">Print / save as PDF</button></div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><p className="font-semibold">Sold by</p><p>{inv.seller.legalName}</p><p className="whitespace-pre-line text-muted">{inv.seller.address}</p>{inv.seller.gstin && <p>GSTIN {inv.seller.gstin}</p>}</div>
        <div><p className="font-semibold">Billed and shipped to</p><p>{inv.buyer.name}</p><p className="text-muted">{inv.buyer.line1}{inv.buyer.line2 && `, ${inv.buyer.line2}`}<br />{inv.buyer.city}, {inv.buyer.state} {inv.buyer.pincode}</p></div>
      </div>
      <table className="w-full text-left"><thead className="border-y border-line text-xs uppercase text-muted"><tr><th className="py-2">Item</th><th>HSN</th><th>Qty</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Total</th></tr></thead>
        <tbody>{inv.lines.map((l, i) => <tr key={i} className="border-b border-line"><td className="py-2">{l.title}<br /><span className="text-xs text-muted">{l.variantTitle}</span></td><td>{l.hsnCode}</td><td>{l.qty}</td><td className="text-right">{formatPaise(l.taxablePaise)}</td><td className="text-right">{l.gstRateBp / 100}%</td><td className="text-right">{formatPaise(l.totalPaise)}</td></tr>)}</tbody></table>
      <div className="ml-auto max-w-xs space-y-1">
        <p className="flex justify-between"><span>Taxable value</span><span>{formatPaise(t.taxablePaise)}</span></p>
        {inv.intraState ? <><p className="flex justify-between"><span>CGST</span><span>{formatPaise(t.cgstPaise)}</span></p><p className="flex justify-between"><span>SGST</span><span>{formatPaise(t.sgstPaise)}</span></p></> : <p className="flex justify-between"><span>IGST</span><span>{formatPaise(t.igstPaise)}</span></p>}
        {inv.shippingPaise > 0 && <p className="flex justify-between"><span>Shipping</span><span>{formatPaise(inv.shippingPaise)}</span></p>}
        <p className="flex justify-between border-t border-line pt-1 text-lg font-bold"><span>Total</span><span>{formatPaise(t.totalPaise)}</span></p>
      </div>
    </main>
  );
}
