import { HttpException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { env } from "../env";

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let cache: { keys: Record<string, string>; exp: number } | null = null;

async function certs() {
  if (cache && cache.exp > Date.now()) return cache.keys;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) throw new HttpException({ title: "Google sign-in is temporarily unavailable" }, 502);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  cache = { keys: (await res.json()) as Record<string, string>, exp: Date.now() + maxAge * 1000 };
  return cache.keys;
}

export const googleEnabled = () => !!env.FIREBASE_PROJECT_ID;

/** Verifies a Firebase ID token the way firebase-admin does (RS256, Google's rotating certs, aud/iss pinned to our project), without the SDK. */
export async function verifyGoogleToken(idToken: string) {
  const project = env.FIREBASE_PROJECT_ID;
  if (!project) throw new HttpException({ title: "Google sign-in isn't set up" }, 503);
  const kid = (jwt.decode(idToken, { complete: true })?.header as { kid?: string } | undefined)?.kid;
  const key = kid && (await certs())[kid];
  const bad = new HttpException({ title: "Google sign-in failed, please try again" }, 401);
  if (!key) throw bad;
  let p: jwt.JwtPayload & { email?: string; email_verified?: boolean; name?: string; firebase?: { sign_in_provider?: string } };
  try { p = jwt.verify(idToken, key, { algorithms: ["RS256"], audience: project, issuer: `https://securetoken.google.com/${project}` }) as typeof p; }
  catch { throw bad; }
  if (!p.sub || !p.email || !p.email_verified || p.firebase?.sign_in_provider !== "google.com") throw bad;
  return { uid: p.sub, email: p.email.toLowerCase(), name: p.name ?? null };
}
