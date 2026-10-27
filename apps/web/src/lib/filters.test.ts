import { expect, it } from "vitest";
import { isFiltered, parsePrice, qs, selected, setParam, toSearchParams, toggle } from "./filters";

it("converts Next searchParams (string | string[]) to URLSearchParams, dropping empties", () => {
  const sp = toSearchParams({ material: ["SS 304", "Copper"], sort: "price_asc", q: "", x: undefined });
  expect(sp.getAll("material")).toEqual(["SS 304", "Copper"]);
  expect(sp.has("q")).toBe(false);
  expect(qs(sp)).toBe("?material=SS+304&material=Copper&sort=price_asc");
});

it("toggles a value on and off and resets paging", () => {
  let sp = toSearchParams({ page: "3" });
  sp = toggle(sp, "colour", "Pink");
  expect(selected(sp, "colour")).toEqual(["Pink"]);
  expect(sp.has("page")).toBe(false);
  sp = toggle(toggle(sp, "colour", "Black"), "colour", "Pink");
  expect(selected(sp, "colour")).toEqual(["Black"]);
  expect(qs(toggle(sp, "colour", "Black"))).toBe("");
});

it("setParam sets/clears and resets paging except when setting page", () => {
  expect(qs(setParam(toSearchParams({ page: "2", sort: "newest" }), "sort", "price_asc"))).toBe("?sort=price_asc");
  expect(qs(setParam(toSearchParams({ sort: "newest" }), "sort", null))).toBe("");
  expect(qs(setParam(toSearchParams({ sort: "newest" }), "page", "2"))).toBe("?sort=newest&page=2");
});

it("isFiltered ignores paging only", () => {
  expect(isFiltered(toSearchParams({ page: "2" }))).toBe(false);
  expect(isFiltered(toSearchParams({ sort: "newest" }))).toBe(true);
});

it("parses price ranges safely", () => {
  expect(parsePrice("200-3000")).toEqual([200, 3000]);
  expect(parsePrice("900-200")).toEqual([200, 900]);
  for (const bad of [null, "", "abc", "1-", "-5", "1-2-3", "1e3-5"]) expect(parsePrice(bad)).toBeNull();
});
