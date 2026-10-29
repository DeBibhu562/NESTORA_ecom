// GST invoice data. Prices are tax-inclusive, so taxable value = line total − tax. Same state as the seller: CGST + SGST halves; otherwise IGST.

type Item = { title: string; variantTitle: string; sku: string; hsnCode: string; gstRateBp: number; qty: number; unitPricePaise: number; totalPaise: number; taxPaise: number };
type Biz = { legalName: string; gstin: string; address: string; state: string; phone: string; email: string };

export function invoiceView(o: { orderNumber: string; invoiceNumber: string; date: Date; shippingPaise: number; discountPaise: number; totalPaise: number; shippingAddress: { name?: string; line1?: string; line2?: string; city?: string; state?: string; pincode?: string }; phone: string; items: Item[]; gstin?: string | null }, seller: Biz) {
  const intra = !!seller.state && !!o.shippingAddress.state && seller.state.trim().toLowerCase() === o.shippingAddress.state.trim().toLowerCase();
  const half = (n: number) => { const a = Math.floor(n / 2); return [a, n - a] as const; };
  const lines = o.items.map((i) => {
    const [cgst, sgst] = intra ? half(i.taxPaise) : [0, 0];
    return { ...i, taxablePaise: i.totalPaise - i.taxPaise, cgstPaise: cgst, sgstPaise: sgst, igstPaise: intra ? 0 : i.taxPaise };
  });
  const sum = (k: "taxablePaise" | "cgstPaise" | "sgstPaise" | "igstPaise") => lines.reduce((n, l) => n + l[k], 0);
  return { invoiceNumber: o.invoiceNumber, orderNumber: o.orderNumber, date: o.date, seller, buyer: { ...o.shippingAddress, phone: o.phone, gstin: o.gstin ?? null }, intraState: intra, lines, shippingPaise: o.shippingPaise, discountPaise: o.discountPaise, totals: { taxablePaise: sum("taxablePaise"), cgstPaise: sum("cgstPaise"), sgstPaise: sum("sgstPaise"), igstPaise: sum("igstPaise"), totalPaise: o.totalPaise } };
}
