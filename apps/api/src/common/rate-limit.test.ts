import { expect, it } from "vitest";
import { RateLimit } from "./rate-limit";

it("allows up to max per window per key, then resets", () => {
  const r = new RateLimit(2, 1000);
  expect([r.allow("a", 0), r.allow("a", 1), r.allow("a", 2)]).toEqual([true, true, false]);
  expect(r.allow("b", 2)).toBe(true);
  expect(r.allow("a", 1001)).toBe(true);
});
