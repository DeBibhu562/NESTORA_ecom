import { expect, it } from "vitest";
import { invoiceView } from "./invoice";

const base = { orderNumber: "ORD-1", invoiceNumber: "INV/2026-27/000001", date: new Date(), shippingPaise: 0, discountPaise: 0, totalPaise: 11800, phone: "9", items: [{ title: "t", variantTitle: "v", sku: "s", hsnCode: "7323", gstRateBp: 1800, qty: 1, unitPricePaise: 11800, totalPaise: 11800, taxPaise: 1801 }] };
const seller = { legalName: "X", gstin: "", address: "", state: "Delhi", phone: "", email: "" };

it("splits GST into CGST+SGST within the seller's state and IGST outside, always summing back to the tax", () => {
  const intra = invoiceView({ ...base, shippingAddress: { state: "delhi" } }, seller);
  expect(intra.lines[0]).toMatchObject({ cgstPaise: 900, sgstPaise: 901, igstPaise: 0, taxablePaise: 9999 });
  const inter = invoiceView({ ...base, shippingAddress: { state: "Karnataka" } }, seller);
  expect(inter.lines[0]).toMatchObject({ cgstPaise: 0, sgstPaise: 0, igstPaise: 1801 });
  expect(intra.totals.cgstPaise + intra.totals.sgstPaise).toBe(1801);
});
