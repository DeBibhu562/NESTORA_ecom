import { expect, it } from "vitest";
import { formatPaise, parseRupees } from "./money";

it("formats paise as Indian rupees", () => {
  expect(formatPaise(80200)).toBe("₹802");
  expect(formatPaise(104950)).toBe("₹1,049.50");
  expect(formatPaise(12345678)).toBe("₹1,23,456.78");
});

it("parses rupee input to exact paise (no float drift)", () => {
  expect(parseRupees("802")).toBe(80200);
  expect(parseRupees("₹1,049.10")).toBe(104910);
  expect(parseRupees("19.99")).toBe(1999);
  expect(parseRupees("0.29")).toBe(29); // 0.29*100 = 28.999… in floats
});

it("rejects junk, zero and >2 decimals", () => {
  for (const bad of ["", "abc", "0", "-5", "1.234", "1e3"]) expect(parseRupees(bad)).toBeNull();
});
