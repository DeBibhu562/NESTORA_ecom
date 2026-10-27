import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { env } from "../env";

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export async function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await scryptAsync(pw, salt, 64)).toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const given = await scryptAsync(pw, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// shortcut: encryption key derived from JWT_SECRET, so rotating it invalidates stored TOTP secrets; use a KMS-held key at hardening (E12)
const key = createHash("sha256").update(`totp-enc:${env.JWT_SECRET}`).digest();

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("hex")).join(".");
}

export function decrypt(stored: string) {
  const [iv, tag, body] = stored.split(".").map((h) => Buffer.from(h!, "hex"));
  const d = createDecipheriv("aes-256-gcm", key, iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(body!), d.final()]).toString("utf8");
}

// ── RFC 6238 TOTP (SHA-1, 6 digits, 30 s) ──
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret() {
  return Array.from(randomBytes(20), (b) => B32[b % 32]).join("");
}

function b32decode(s: string) {
  let bits = "";
  for (const ch of s) bits += B32.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

export function totpAt(secret: string, timeMs: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 30000)));
  const h = createHmac("sha1", b32decode(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  const code = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/** Accepts the previous, current and next window to tolerate clock drift. */
export function verifyTotp(secret: string, code: string, now = Date.now()) {
  return [-1, 0, 1].some((w) => {
    const expected = Buffer.from(totpAt(secret, now + w * 30000));
    const given = Buffer.from(code);
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}
