import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../env";

// Customer payout details (UPI id / bank) are encrypted at rest. shortcut: key derives from JWT_SECRET, so rotating it orphans old values; move to a dedicated KMS key before scale.
const key = () => createHash("sha256").update(`payout:${env.JWT_SECRET}`).digest();

export function seal(text: string) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function unseal(blob: string | null) {
  if (!blob) return null;
  try {
    const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64")) as [Buffer, Buffer, Buffer];
    const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch { return null; }
}
