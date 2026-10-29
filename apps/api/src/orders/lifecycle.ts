// Pure rules for the post-order lifecycle: no I/O, so they are unit-tested and shared by every caller.

export type OrderStatus = "PENDING_PAYMENT" | "PLACED" | "CONFIRMED" | "PROCESSING" | "PARTIALLY_SHIPPED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "CLOSED";
export type Step = "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED";

/** Each forward step has exactly one legal source status. */
export const FROM: Record<Step, OrderStatus> = { CONFIRMED: "PLACED", PROCESSING: "CONFIRMED", SHIPPED: "PROCESSING", DELIVERED: "SHIPPED" };
export const NEXT: Partial<Record<OrderStatus, Step>> = { PLACED: "CONFIRMED", CONFIRMED: "PROCESSING", PROCESSING: "SHIPPED", SHIPPED: "DELIVERED" };
export const CANNOT_CANCEL: OrderStatus[] = ["SHIPPED", "PARTIALLY_SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "CLOSED"];

export const canAdvance = (from: OrderStatus, to: Step) => FROM[to] === from;
export const canCancel = (s: OrderStatus) => !CANNOT_CANCEL.includes(s);

export const DAY = 86_400_000;
export type ReturnRules = { windowDays: number; graceDays: number; pickupFeePaise: number };
export const DEFAULT_RETURN_RULES: ReturnRules = { windowDays: 7, graceDays: 1, pickupFeePaise: 0 };

export const REASONS = ["DAMAGED", "DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGED_MIND"] as const;
export type Reason = (typeof REASONS)[number];
/** Reasons that are our fault or a real defect: photos are required, store pays pickup, shipping is refunded, engraved items qualify. */
export const FAULT: Reason[] = ["DAMAGED", "DEFECTIVE", "WRONG_ITEM"];

export const windowEnds = (deliveredAt: Date, r: ReturnRules) => new Date(deliveredAt.getTime() + r.windowDays * DAY);
export const daysLeft = (deliveredAt: Date, r: ReturnRules, now = new Date()) => Math.max(0, Math.ceil((windowEnds(deliveredAt, r).getTime() - now.getTime()) / DAY));

type Line = { id: string; qty: number; engraving: string | null; alreadyReturned: number };
export type Asked = { orderItemId: string; qty: number };

/** Returns the first reason a request is not allowed, or null. */
export function returnProblem(o: { status: OrderStatus; deliveredAt: Date | null }, lines: Line[], asked: Asked[], reason: Reason, rules: ReturnRules, now = new Date()): string | null {
  if (o.status !== "DELIVERED" || !o.deliveredAt) return "Only delivered orders can be returned";
  if (now > windowEnds(o.deliveredAt, rules)) return `The ${rules.windowDays}-day return window has ended`;
  if (!asked.length) return "Choose at least one item";
  if (new Set(asked.map((a) => a.orderItemId)).size !== asked.length) return "Each item can only be listed once";
  for (const a of asked) {
    const l = lines.find((x) => x.id === a.orderItemId);
    if (!l) return "Unknown item";
    if (a.qty < 1 || a.qty > l.qty - l.alreadyReturned) return "You can't return more than you received";
    if (l.engraving && !FAULT.includes(reason)) return "Engraved items can only be returned if they are damaged, defective or not what you ordered";
  }
  return null;
}

/**
 * Refund for returned items: each line's net (after discounts, tax-inclusive) pro-rated by quantity. Shipping comes back only when
 * everything on the order is returned and the fault is ours; change-of-mind returns pay the pickup fee. Never exceeds what was paid.
 */
export function refundAmount(o: { shippingPaise: number; totalPaise: number }, lines: { id: string; qty: number; totalPaise: number; alreadyReturned: number }[], asked: Asked[], reason: Reason, rules: ReturnRules) {
  let items = 0, allBack = true;
  for (const l of lines) {
    const q = asked.find((a) => a.orderItemId === l.id)?.qty ?? 0;
    const done = l.alreadyReturned;
    if (q + done < l.qty) allBack = false;
    // Pro-rate by cumulative quantity so the pieces of a split return add up to the line total exactly.
    const upto = (n: number) => Math.round((l.totalPaise * n) / l.qty);
    items += upto(done + q) - upto(done);
  }
  const shipping = allBack && FAULT.includes(reason) ? o.shippingPaise : 0;
  const fee = FAULT.includes(reason) ? 0 : rules.pickupFeePaise;
  return Math.max(0, Math.min(items + shipping - fee, o.totalPaise));
}
