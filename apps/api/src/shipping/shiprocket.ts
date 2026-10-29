import { HttpException } from "@nestjs/common";
import { env } from "../env";

// Written against Shiprocket's public API docs; check field names against your live account before launch.
const BASE = "https://apiv2.shiprocket.in/v1/external";
export const shiprocketEnabled = () => !!(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);

let token: { value: string; at: number } | null = null;
const fail = (title: string) => new HttpException({ title }, 502);

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  if (!token || Date.now() - token.at > 8 * 24 * 3600_000) { // tokens last 10 days
    const r = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }), signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { token?: string } | null;
    if (!j?.token) throw fail("Could not sign in to Shiprocket, check the account details");
    token = { value: j.token, at: Date.now() };
  }
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"), headers: { "content-type": "application/json", authorization: `Bearer ${token.value}` },
    body: init.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (res?.status === 401 && retry) { token = null; return call<T>(path, init, false); }
  const data = (await res?.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res?.ok || !data) throw fail(`Shiprocket: ${data?.message ?? "request failed"}`);
  return data;
}

export type BookInput = {
  orderNumber: string; placedAt: Date; cod: boolean; totalPaise: number; shippingPaise: number; discountPaise: number;
  customer: { name: string; phone: string; email: string | null; line1: string; line2?: string; city: string; state: string; pincode: string };
  items: { title: string; sku: string; qty: number; unitPricePaise: number; hsn: string }[]; weightGrams: number;
};

/** Creates the order, picks the courier Shiprocket recommends, and returns the AWB plus label and tracking link. */
export async function bookShipment(i: BookInput) {
  const rupees = (p: number) => Math.round(p) / 100;
  const created = await call<{ order_id: number; shipment_id: number }>("/orders/create/adhoc", { body: {
    order_id: i.orderNumber, order_date: i.placedAt.toISOString().slice(0, 16).replace("T", " "), pickup_location: env.SHIPROCKET_PICKUP,
    billing_customer_name: i.customer.name, billing_last_name: "", billing_address: i.customer.line1, billing_address_2: i.customer.line2 ?? "", billing_city: i.customer.city,
    billing_pincode: i.customer.pincode, billing_state: i.customer.state, billing_country: "India", billing_email: i.customer.email ?? "", billing_phone: i.customer.phone.replace(/\D/g, "").slice(-10),
    shipping_is_billing: true,
    order_items: i.items.map((x) => ({ name: x.title, sku: x.sku, units: x.qty, selling_price: rupees(x.unitPricePaise), hsn: x.hsn })),
    payment_method: i.cod ? "COD" : "Prepaid", shipping_charges: rupees(i.shippingPaise), total_discount: rupees(i.discountPaise), sub_total: rupees(i.totalPaise),
    length: 10, breadth: 10, height: 25, weight: Math.max(0.1, i.weightGrams / 1000),
  } });
  const awb = await call<{ response?: { data?: { awb_code?: string; courier_name?: string } } }>("/courier/assign/awb", { body: { shipment_id: created.shipment_id } });
  const d = awb.response?.data;
  if (!d?.awb_code) throw fail("Shiprocket could not assign a courier for this pincode. Enter the AWB by hand instead.");
  await call("/courier/generate/pickup", { body: { shipment_id: [created.shipment_id] } }).catch(() => undefined); // pickup can be requested later from the panel
  const label = await call<{ label_url?: string }>("/courier/generate/label", { body: { shipment_id: [created.shipment_id] } }).catch(() => ({ label_url: undefined }));
  return { courier: d.courier_name ?? null, awb: d.awb_code, trackingUrl: `https://shiprocket.co/tracking/${d.awb_code}`, labelUrl: label.label_url ?? null, providerOrderId: String(created.order_id), providerShipmentId: String(created.shipment_id) };
}

export async function cancelShipment(providerOrderId: string) { await call("/orders/cancel", { body: { ids: [Number(providerOrderId)] } }); }

export type TrackEvent = { status: string; location: string | null; at: Date };
export async function trackAwb(awb: string): Promise<TrackEvent[]> {
  const r = await call<{ tracking_data?: { shipment_track_activities?: { activity?: string; "sr-status-label"?: string; location?: string; date?: string }[] } }>(`/courier/track/awb/${encodeURIComponent(awb)}`);
  return (r.tracking_data?.shipment_track_activities ?? []).map((a) => ({ status: a["sr-status-label"] || a.activity || "Update", location: a.location ?? null, at: a.date ? new Date(a.date.replace(" ", "T") + "+05:30") : new Date() })).reverse();
}
