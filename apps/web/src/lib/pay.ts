import { API } from "./api";

type Retry = { keyId: string | null; orderId: string; amountPaise: number };
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void } } }

const loadScript = () => new Promise<boolean>((ok) => {
  if (window.Razorpay) return ok(true);
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => ok(true); s.onerror = () => ok(false);
  document.body.appendChild(s);
});

/** Opens Razorpay checkout. `done` runs after the server has verified the payment; closing the modal just resolves "dismissed". */
export async function payWithRazorpay(r: Retry, prefill: { name?: string; contact?: string; email?: string }, brand: string): Promise<"paid" | "dismissed" | "error"> {
  if (!r.keyId || !(await loadScript()) || !window.Razorpay) return "error";
  return new Promise((resolve) => {
    new window.Razorpay!({
      key: r.keyId, order_id: r.orderId, amount: r.amountPaise, currency: "INR", name: brand, prefill,
      handler: async (resp: Record<string, string>) => {
        const res = await fetch(`${API}/checkout/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp) }).catch(() => null);
        resolve(res?.ok ? "paid" : "error");
      },
      modal: { ondismiss: () => resolve("dismissed") },
    }).open();
  });
}
