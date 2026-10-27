import { expect, it } from "vitest";
import { decrypt, encrypt, hashPassword, totpAt, verifyPassword, verifyTotp } from "./crypto";

it("hashes and verifies passwords", async () => {
  const h = await hashPassword("pw-123");
  expect(await verifyPassword("pw-123", h)).toBe(true);
  expect(await verifyPassword("nope", h)).toBe(false);
  expect(await verifyPassword("x", "garbage")).toBe(false);
});

it("encrypts round-trip and rejects tampering", () => {
  const c = encrypt("SECRET");
  expect(decrypt(c)).toBe("SECRET");
  expect(() => decrypt(c.replace(/.$/, c.endsWith("0") ? "1" : "0"))).toThrow();
});

it("TOTP matches the RFC 6238 SHA-1 test vector", () => {
  // secret "12345678901234567890" in base32; T=59s → 94287082 (8 digits) → last 6 = 287082
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  expect(totpAt(secret, 59_000)).toBe("287082");
  expect(verifyTotp(secret, "287082", 59_000)).toBe(true);
  expect(verifyTotp(secret, "287082", 59_000 + 120_000)).toBe(false);
});
