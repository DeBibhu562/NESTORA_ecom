import { expect, it } from "vitest";
import { allocate, priceCart, type PriceInput } from "./pricing";

const line = (id: string, unitPaise: number, qty = 1, couponEligible = true) => ({ id, unitPaise, qty, gstRateBp: 1800, couponEligible });

it("matches the appendix D golden example", () => {
  const r = priceCart({
    lines: [line("felice", 80200), line("brush", 14900)],
    coupon: { type: "PERCENT", valueBp: 1500 }, paymentOfferBp: 300,
    freeShippingAbovePaise: 69900, shippingPaise: 9900, intraState: true,
  });
  expect(r.lines.map((l) => l.coupon)).toEqual([12030, 2235]);
  expect(r.lines.map((l) => l.offer)).toEqual([2045, 380]);
  expect(r.lines.map((l) => l.net)).toEqual([66125, 12285]);
  expect(r.lines.map((l) => l.tax)).toEqual([10087, 1874]);
  expect(r.lines.map((l) => [l.cgst, l.sgst])).toEqual([[5043, 5044], [937, 937]]);
  expect(r).toMatchObject({ shipping: 0, total: 78410, tax: 11961 });
});

it("charges shipping under the threshold and honours minSubtotal / FREE_SHIPPING", () => {
  const base: PriceInput = { lines: [line("a", 10000)], freeShippingAbovePaise: 69900, shippingPaise: 5000, intraState: false };
  expect(priceCart(base)).toMatchObject({ shipping: 5000, total: 15000 });
  expect(priceCart({ ...base, coupon: { type: "FREE_SHIPPING" } })).toMatchObject({ shipping: 0, total: 10000 });
  const r = priceCart({ ...base, coupon: { type: "FLAT", valuePaise: 500, minSubtotalPaise: 20000 } });
  expect(r.couponApplied).toBe(false);
  expect(r.lines[0]!.igst).toBe(r.lines[0]!.tax);
});

it("excludes ineligible lines and caps discounts", () => {
  const r = priceCart({
    lines: [line("a", 10000), line("b", 10000, 1, false)],
    coupon: { type: "FLAT", valuePaise: 99999 }, freeShippingAbovePaise: 0, shippingPaise: 0, intraState: true,
  });
  expect(r.lines.map((l) => l.coupon)).toEqual([10000, 0]);
});

it("preserves invariants on random carts", () => {
  let s = 42; // seeded LCG so failures reproduce
  const rnd = (n: number) => ((s = (s * 1664525 + 1013904223) % 2 ** 32), s % n);
  for (let k = 0; k < 2000; k++) {
    const lines = Array.from({ length: 1 + rnd(5) }, (_, i) => line(`l${i}`, 100 + rnd(500000), 1 + rnd(4), rnd(4) > 0));
    const input: PriceInput = {
      lines, freeShippingAbovePaise: rnd(200000), shippingPaise: rnd(20000), intraState: rnd(2) === 0,
      paymentOfferBp: rnd(1000),
      coupon: [undefined, { type: "PERCENT" as const, valueBp: rnd(10001), maxDiscountPaise: rnd(2) ? rnd(100000) : undefined }, { type: "FLAT" as const, valuePaise: rnd(300000) }][rnd(3)],
    };
    const r = priceCart(input);
    expect(priceCart(input)).toEqual(r);
    expect(r.lines.reduce((a, l) => a + l.net, 0) + r.shipping).toBe(r.total);
    expect(r.lines.reduce((a, l) => a + l.tax, 0)).toBe(r.tax);
    expect(r.subtotal - r.couponDiscount - r.offerDiscount + r.shipping).toBe(r.total);
    for (const l of r.lines) { expect(l.net).toBeGreaterThanOrEqual(0); expect(l.cgst + l.sgst + l.igst).toBe(l.tax); }
  }
});

it("allocate sums exactly", () => {
  expect(allocate(7, [1, 1, 1])).toEqual([3, 2, 2]);
  expect(allocate(0, [1, 2])).toEqual([0, 0]);
});

it("takes a milestone reward off after the coupon, capped, with GST reconciling", () => {
  const base: PriceInput = { lines: [line("a", 150000), line("b", 50001)], freeShippingAbovePaise: 69900, shippingPaise: 9900, intraState: true };
  const r = priceCart({ ...base, rewardPaise: 30000 });
  expect(r.rewardDiscount).toBe(30000);
  expect(r.total).toBe(200001 - 30000);
  expect(r.lines.reduce((n, l) => n + l.reward, 0)).toBe(30000);
  expect(priceCart({ ...base, lines: [line("a", 100)], rewardPaise: 30000 }).total).toBeGreaterThanOrEqual(0);
});
