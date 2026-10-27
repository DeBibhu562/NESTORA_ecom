export type OptionInput = { values: { id: string; value: string }[] };
export type Defaults = { pricePaise: number; mrpPaise: number; weightGrams: number };
export type Generated = Defaults & { sku: string; optionValueIds: string[] };

const abbr = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "X";

/**
 * One variant per combination of option values (cartesian product), skipping combinations
 * that already exist. SKUs are `<prefix>-<abbr>-<abbr>…`, suffixed -2, -3… on collision.
 * `existing` holds keys from `comboKey`; `takenSkus` is mutated-by-copy, not by the caller.
 */
export function generateVariants(options: OptionInput[], existing: Set<string>, takenSkus: Set<string>, prefix: string, d: Defaults): Generated[] {
  if (options.length === 0 || options.some((o) => o.values.length === 0)) return [];
  const taken = new Set(takenSkus);
  let combos: { id: string; value: string }[][] = [[]];
  for (const o of options) combos = combos.flatMap((c) => o.values.map((v) => [...c, v]));

  const out: Generated[] = [];
  for (const c of combos) {
    const ids = c.map((v) => v.id);
    if (existing.has(comboKey(ids))) continue;
    const base = [prefix, ...c.map((v) => abbr(v.value))].join("-");
    let sku = base;
    for (let n = 2; taken.has(sku); n++) sku = `${base}-${n}`;
    taken.add(sku);
    out.push({ ...d, sku, optionValueIds: ids });
  }
  return out;
}

export const comboKey = (ids: string[]) => [...ids].sort().join("|");
