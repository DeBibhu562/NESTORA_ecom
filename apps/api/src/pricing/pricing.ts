// Pure pricing engine. All amounts are integer paise; prices are GST-inclusive.
export interface PriceLine { id: string; unitPaise: number; qty: number; gstRateBp: number; couponEligible: boolean }
export interface PriceCoupon { type: "PERCENT" | "FLAT" | "FREE_SHIPPING"; valueBp?: number; valuePaise?: number; maxDiscountPaise?: number; minSubtotalPaise?: number }
export interface PriceInput {
  lines: PriceLine[];
  coupon?: PriceCoupon;
  paymentOfferBp?: number; // e.g. 300 = 3% off for UPI
  freeShippingAbovePaise: number;
  shippingPaise: number;
  intraState: boolean; // CGST+SGST vs IGST
}
export interface PricedLine {
  id: string; subtotal: number; coupon: number; offer: number; net: number;
  tax: number; cgst: number; sgst: number; igst: number;
}
export interface PriceResult {
  lines: PricedLine[]; subtotal: number; couponDiscount: number; offerDiscount: number;
  shipping: number; tax: number; total: number; couponApplied: boolean;
}

// Largest-remainder split: parts sum exactly to `amount`, ties go to the earlier line.
export function allocate(amount: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (amount <= 0 || sum <= 0) return weights.map(() => 0);
  const parts = weights.map((w) => Math.floor((amount * w) / sum));
  let left = amount - parts.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, r: (amount * w) % sum }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) { if (left-- <= 0) break; parts[i]!++; }
  return parts;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function priceCart(input: PriceInput): PriceResult {
  const { lines } = input;
  const sub = lines.map((l) => l.unitPaise * l.qty);
  const subtotal = sum(sub);

  const c = input.coupon;
  const eligible = lines.map((l, i) => (l.couponEligible ? sub[i]! : 0));
  const eligibleTotal = sum(eligible);
  const couponApplied = !!c && eligibleTotal > 0 && subtotal >= (c.minSubtotalPaise ?? 0);
  let couponDiscount = 0;
  if (c && couponApplied) {
    if (c.type === "PERCENT") couponDiscount = Math.round((eligibleTotal * (c.valueBp ?? 0)) / 10000);
    else if (c.type === "FLAT") couponDiscount = c.valuePaise ?? 0;
    if (c.maxDiscountPaise != null) couponDiscount = Math.min(couponDiscount, c.maxDiscountPaise);
    couponDiscount = Math.max(0, Math.min(couponDiscount, eligibleTotal));
  }
  const couponParts = allocate(couponDiscount, eligible);
  const afterCoupon = sub.map((s, i) => s - couponParts[i]!);  const afterCouponTotal = sum(afterCoupon);

  // Offer applies to the post-coupon amount; free-shipping threshold is checked before it.
  const offerDiscount = Math.round((afterCouponTotal * (input.paymentOfferBp ?? 0)) / 10000);
  const offerParts = allocate(offerDiscount, afterCoupon);
  const freeShip = (couponApplied && c!.type === "FREE_SHIPPING") || afterCouponTotal >= input.freeShippingAbovePaise;
  const shipping = lines.length === 0 || freeShip ? 0 : input.shippingPaise;

  const priced = lines.map((l, i): PricedLine => {
    const net = afterCoupon[i]! - offerParts[i]!;
    const tax = Math.round((net * l.gstRateBp) / (10000 + l.gstRateBp));
    const cgst = input.intraState ? Math.floor(tax / 2) : 0; // odd paise goes to SGST
    return {
      id: l.id, subtotal: sub[i]!, coupon: couponParts[i]!, offer: offerParts[i]!, net, tax,
      cgst, sgst: input.intraState ? tax - cgst : 0, igst: input.intraState ? 0 : tax,
    };
  });
  // shortcut: GST on shipping is not split out, add it when invoices are built (Phase 4).
  return {
    lines: priced, subtotal, couponDiscount, offerDiscount, shipping,
    tax: sum(priced.map((p) => p.tax)), total: sum(priced.map((p) => p.net)) + shipping, couponApplied,
  };
}
