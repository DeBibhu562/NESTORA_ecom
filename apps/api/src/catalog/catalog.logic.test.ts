import { expect, it } from "vitest";
import { validateAttributes } from "./attributes";
import { slugify } from "./slug";
import { comboKey, generateVariants } from "./variants";

const d = { pricePaise: 80200, mrpPaise: 98000, weightGrams: 360 };
const cap = { values: [{ id: "c1", value: "550 ml" }, { id: "c2", value: "715 ml" }, { id: "c3", value: "880 ml" }] };
const col = { values: [{ id: "k1", value: "Pink" }, { id: "k2", value: "Ivory" }, { id: "k3", value: "Black" }, { id: "k4", value: "Olive Green" }] };

it("generates the full 3x4 matrix with unique SKUs", () => {
  const v = generateVariants([cap, col], new Set(), new Set(), "MIL-FEL", d);
  expect(v).toHaveLength(12);
  expect(new Set(v.map((x) => x.sku)).size).toBe(12);
  expect(v[0]).toMatchObject({ sku: "MIL-FEL-550-PIN", optionValueIds: ["c1", "k1"] });
  expect(v.map((x) => x.sku)).toContain("MIL-FEL-880-OLI");
});

it("skips existing combos and avoids taken SKUs", () => {
  const v = generateVariants([cap, col], new Set([comboKey(["k1", "c1"])]), new Set(["MIL-FEL-550-IVO"]), "MIL-FEL", d);
  expect(v).toHaveLength(11);
  expect(v.find((x) => x.optionValueIds.join() === "c1,k2")!.sku).toBe("MIL-FEL-550-IVO-2");
});

it("suffixes colliding abbreviations and handles empty input", () => {
  const o = { values: [{ id: "a", value: "Blue Sky" }, { id: "b", value: "Blue Sea" }] };
  expect(generateVariants([o], new Set(), new Set(), "P", d).map((x) => x.sku)).toEqual(["P-BLU", "P-BLU-2"]);
  expect(generateVariants([], new Set(), new Set(), "P", d)).toEqual([]);
  expect(generateVariants([{ values: [] }], new Set(), new Set(), "P", d)).toEqual([]);
});

const defs = [
  { key: "material", label: "Material", type: "ENUM" as const, enumValues: ["SS 304", "Copper"], isRequired: true },
  { key: "leak_proof", label: "Leak proof", type: "BOOLEAN" as const, enumValues: [], isRequired: false },
  { key: "weight", label: "Weight", type: "NUMBER" as const, enumValues: [], isRequired: false },
];

it("validates attribute types, enums and unknown keys", () => {
  expect(validateAttributes({ material: "SS 304", leak_proof: true, weight: 360 }, defs, true)).toEqual([]);
  expect(validateAttributes({ material: "Gold" }, defs, false)).toEqual(['Invalid value for "Material"']);
  expect(validateAttributes({ nope: 1 }, defs, false)).toEqual(['Unknown attribute "nope"']);
  expect(validateAttributes({ weight: "x" }, defs, false)).toEqual(['Invalid value for "Weight"']);
});

it("only enforces required attributes when asked", () => {
  expect(validateAttributes({}, defs, false)).toEqual([]);
  expect(validateAttributes({}, defs, true)).toEqual(['"Material" is required']);
});

it("slugifies", () => {
  expect(slugify("Felice Thermosteel Bottle (Milton)!")).toBe("felice-thermosteel-bottle-milton");
  expect(slugify("!!!")).toBe("item");
});
