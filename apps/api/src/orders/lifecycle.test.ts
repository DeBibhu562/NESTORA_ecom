import { describe, expect, it } from "vitest";
import { canAdvance, canCancel, daysLeft, DAY, DEFAULT_RETURN_RULES as R, refundAmount, returnProblem } from "./lifecycle";

const lines = [{ id: "a", qty: 3, engraving: null, alreadyReturned: 0 }, { id: "b", qty: 1, engraving: "Asha", alreadyReturned: 0 }];
const delivered = (daysAgo: number) => ({ status: "DELIVERED" as const, deliveredAt: new Date(Date.now() - daysAgo * DAY) });

describe("transitions", () => {
  it("only allows each step from its one legal status", () => {
    expect(canAdvance("PLACED", "CONFIRMED")).toBe(true);
    expect(canAdvance("PLACED", "SHIPPED")).toBe(false);
    expect(canAdvance("DELIVERED", "DELIVERED")).toBe(false);
    expect(canCancel("PROCESSING")).toBe(true);
    expect(canCancel("SHIPPED")).toBe(false);
  });
});

describe("return eligibility", () => {
  it("honours the 7-day window edge", () => {
    expect(returnProblem(delivered(6.9), lines, [{ orderItemId: "a", qty: 1 }], "CHANGED_MIND", R)).toBeNull();
    expect(returnProblem(delivered(7.1), lines, [{ orderItemId: "a", qty: 1 }], "CHANGED_MIND", R)).toMatch(/window/);
    expect(daysLeft(delivered(2).deliveredAt, R)).toBe(5);
  });
  it("rejects undelivered orders, over-returns and duplicates", () => {
    expect(returnProblem({ status: "SHIPPED", deliveredAt: null }, lines, [{ orderItemId: "a", qty: 1 }], "DAMAGED", R)).toMatch(/delivered/);
    expect(returnProblem(delivered(1), lines, [{ orderItemId: "a", qty: 4 }], "DAMAGED", R)).toMatch(/more than/);
    expect(returnProblem(delivered(1), [{ ...lines[0]!, alreadyReturned: 3 }], [{ orderItemId: "a", qty: 1 }], "DAMAGED", R)).toMatch(/more than/);
    expect(returnProblem(delivered(1), lines, [{ orderItemId: "a", qty: 1 }, { orderItemId: "a", qty: 1 }], "DAMAGED", R)).toMatch(/once/);
  });
  it("keeps engraved items to defects only", () => {
    expect(returnProblem(delivered(1), lines, [{ orderItemId: "b", qty: 1 }], "CHANGED_MIND", R)).toMatch(/Engraved/);
    expect(returnProblem(delivered(1), lines, [{ orderItemId: "b", qty: 1 }], "DEFECTIVE", R)).toBeNull();
  });
});

describe("refund amount", () => {
  const o = { shippingPaise: 9900, totalPaise: 10000 + 9900 };
  const l = [{ id: "a", qty: 3, totalPaise: 10000, alreadyReturned: 0 }];
  it("pro-rates, and split returns add up to the line total exactly", () => {
    const one = refundAmount(o, l, [{ orderItemId: "a", qty: 1 }], "CHANGED_MIND", R);
    const rest = refundAmount(o, [{ ...l[0]!, alreadyReturned: 1 }], [{ orderItemId: "a", qty: 2 }], "CHANGED_MIND", R);
    expect(one + rest).toBe(10000);
  });
  it("refunds shipping only for a full return that is our fault", () => {
    expect(refundAmount(o, l, [{ orderItemId: "a", qty: 3 }], "DAMAGED", R)).toBe(19900);
    expect(refundAmount(o, l, [{ orderItemId: "a", qty: 3 }], "CHANGED_MIND", R)).toBe(10000);
    expect(refundAmount(o, l, [{ orderItemId: "a", qty: 1 }], "DAMAGED", R)).toBe(3333);
  });
  it("deducts the pickup fee for change of mind and never exceeds the order total", () => {
    expect(refundAmount(o, l, [{ orderItemId: "a", qty: 3 }], "CHANGED_MIND", { ...R, pickupFeePaise: 5000 })).toBe(5000);
    expect(refundAmount({ shippingPaise: 0, totalPaise: 100 }, l, [{ orderItemId: "a", qty: 3 }], "DAMAGED", R)).toBe(100);
  });
});
