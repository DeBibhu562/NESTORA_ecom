import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpException } from "@nestjs/common";
import { env } from "../env";

export const razorpayEnabled = () => !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

async function rzp<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) throw new HttpException({ title: "Payment provider is unavailable, please try again" }, 502);
  return res.json() as Promise<T>;
}

export const createRzpOrder = (amountPaise: number, receipt: string) => rzp<{ id: string }>("/orders", { amount: amountPaise, currency: "INR", receipt });
export const refundRzp = (paymentId: string, amountPaise: number) => rzp<{ id: string }>(`/payments/${paymentId}/refund`, { amount: amountPaise });

/** Constant-time HMAC-SHA256 hex check, shared by the checkout callback and the webhook. */
export function validSignature(payload: string | Buffer, signature: string | undefined, secret: string | undefined) {
  if (!signature || !secret) return false;
  const a = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex")), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
