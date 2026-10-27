export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4010/v1";

export class ApiError extends Error {
  constructor(public status: number, public title: string, public errors: { path: string; message: string }[] = [], public code?: string) {
    super(title);
  }
  /** Human-readable, one line per problem. */
  get lines() { return this.errors.length ? this.errors.map((e) => e.message) : [this.title]; }
}

let refreshing: Promise<boolean> | null = null;
const refresh = () => (refreshing ??= fetch(`${API}/admin/auth/refresh`, { method: "POST", credentials: "include" }).then((r) => r.ok).finally(() => { refreshing = null; }));

export async function api<T = unknown>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    method, credentials: "include",
    headers: body !== undefined && !isForm ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 401 && retry && !path.startsWith("/admin/auth/") && (await refresh())) return api<T>(method, path, body, false);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.title ?? res.statusText, data?.errors ?? [], data?.code);
  return data as T;
}

export const get = <T,>(p: string) => api<T>("GET", p);
export const post = <T,>(p: string, b?: unknown) => api<T>("POST", p, b ?? {});
export const patch = <T,>(p: string, b: unknown) => api<T>("PATCH", p, b);
export const put = <T,>(p: string, b: unknown) => api<T>("PUT", p, b);
export const del = (p: string) => api("DELETE", p);

// ── shapes the admin uses (mirrors the API; shared contracts package is a later refactor) ──
export type OptionValue = { id: string; value: string; hexColor: string | null };
export type Option = { id: string; name: string; displayAs: string; values: OptionValue[] };
export type Variant = { id: string; sku: string; pricePaise: number; mrpPaise: number; weightGrams: number; barcode: string | null; isActive: boolean; options: { optionValueId: string }[]; inventory: { warehouseId: string; onHand: number; reserved: number }[] };
export type Media = { id: string; url: string; alt: string; optionValueId: string | null };
export type Product = {
  id: string; slug: string; title: string; tagline: string | null; descriptionHtml: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; categoryId: string;
  hsnCode: string; gstRateBp: number; attributes: Record<string, unknown>; badges: string[]; warrantyMonths: number | null;
  personalizationEnabled: boolean; personalizationPricePaise: number | null; options: Option[]; variants: Variant[]; media: Media[];
};
export type Category = { id: string; name: string; slug: string; path: string; isActive: boolean; productCount: number; children: Category[] };
export type AttrDef = { id: string; key: string; label: string; type: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN"; unit: string | null; enumValues: string[]; isRequired: boolean };
export type Warehouse = { id: string; name: string; code: string };

export const flattenCategories = (tree: Category[], depth = 0): (Category & { depth: number })[] =>
  tree.flatMap((c) => [{ ...c, depth }, ...flattenCategories(c.children, depth + 1)]);
