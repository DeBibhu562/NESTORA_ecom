// Collection filter state lives entirely in the URL: ?material=SS+304&material=Copper&price=200-900&sort=price_asc&page=2

export type Params = Record<string, string | string[] | undefined>;

export const toSearchParams = (p: Params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) if (x !== "") sp.append(k, x);
  return sp;
};

/** Adds the value if absent, removes it if present; always resets to page 1. */
export function toggle(sp: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(sp);
  const cur = next.getAll(key);
  next.delete(key);
  (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]).forEach((v) => next.append(key, v));
  next.delete("page");
  return next;
}

export function setParam(sp: URLSearchParams, key: string, value: string | null) {
  const next = new URLSearchParams(sp);
  if (value === null || value === "") next.delete(key); else next.set(key, value);
  if (key !== "page") next.delete("page");
  return next;
}

/** Everything that narrows or reorders the list (so the URL should not be indexed). */
export const isFiltered = (sp: URLSearchParams) => [...new Set([...sp.keys()])].some((k) => k !== "page");
export const selected = (sp: URLSearchParams, key: string) => sp.getAll(key);

/** "200-3000" (rupees) → [200, 3000]; null if malformed. */
export function parsePrice(v: string | null): [number, number] | null {
  const m = /^(\d{1,6})-(\d{1,6})$/.exec(v ?? "");
  return m ? [Math.min(+m[1]!, +m[2]!), Math.max(+m[1]!, +m[2]!)] : null;
}

export const qs = (sp: URLSearchParams) => (sp.toString() ? `?${sp}` : "");
