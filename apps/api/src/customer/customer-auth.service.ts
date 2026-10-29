import { HttpException, Injectable } from "@nestjs/common";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { hashPassword, sha256, verifyPassword } from "../auth/crypto";
import { Limiter } from "../common/limiter.service";
import { env } from "../env";
import { Notifier } from "../notify/notifier.service";
import { PrismaService } from "../prisma.service";
import { verifyGoogleToken } from "./firebase";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 3600_000;
const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const COOLDOWN_MS = process.env.NODE_ENV === "test" ? 0 : 30_000;
const err = (status: number, title: string, code?: string) => new HttpException({ title, ...(code && { code }) }, status);

/** Signed-in customer id from the `cu` cookie, or null. Guest-friendly routes use this; account routes use `requireUser`. */
export function userIdFrom(req: Request): string | null {
  const t = req.cookies?.cu as string | undefined;
  if (!t) return null;
  try { return (jwt.verify(t, env.JWT_SECRET, { algorithms: ["HS256"], audience: "customer" }) as jwt.JwtPayload).sub ?? null; } catch { return null; }
}
export function requireUser(req: Request) {
  const id = userIdFrom(req);
  if (!id) throw err(401, "Please sign in");
  return id;
}

export type Tokens = { userId: string; access: string; refresh: string; accessMaxAgeMs: number; refreshMaxAgeMs: number };
type Ctx = { ip?: string; userAgent?: string };

@Injectable()
export class CustomerAuthService {
  constructor(private readonly db: PrismaService, private readonly mail: Notifier, private readonly limiter: Limiter) {}

  private norm = (e: string) => e.trim().toLowerCase();
  private codeHash = (target: string, code: string) => createHmac("sha256", env.JWT_SECRET).update(`${target}|${code}`).digest("hex");

  // ── one-time codes (email today; the same challenge can be sent over WhatsApp later) ──
  private async sendCode(email: string, purpose: "signup" | "login" | "reset") {
    const now = Date.now();
    const recent = await this.db.otpChallenge.findMany({ where: { target: email, createdAt: { gt: new Date(now - 3600_000) } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (recent.length >= 5) throw err(429, "Too many codes requested, try again in an hour");
    if (recent[0] && now - recent[0].createdAt.getTime() < COOLDOWN_MS) throw err(429, "Please wait a few seconds before requesting another code");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.db.otpChallenge.updateMany({ where: { target: email, consumedAt: null }, data: { consumedAt: new Date() } });
    await this.db.otpChallenge.create({ data: { target: email, purpose, codeHash: this.codeHash(email, code), expiresAt: new Date(now + OTP_TTL_MS) } });
    const ok = await this.mail.email(email, `Your verification code: ${code}`, `Your ${{ signup: "verification", login: "sign-in", reset: "password reset" }[purpose]} code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`);
    if (!ok) throw err(502, "We couldn't send the email right now, please try again");
  }

  private async consumeCode(email: string, code: string) {
    const c = await this.db.otpChallenge.findFirst({ where: { target: email, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    const bad = err(400, "That code is incorrect or has expired");
    if (!c || c.attempts >= OTP_MAX_ATTEMPTS) throw bad;
    const a = Buffer.from(this.codeHash(email, code)), b = Buffer.from(c.codeHash);
    if (!timingSafeEqual(a, b)) { await this.db.otpChallenge.update({ where: { id: c.id }, data: { attempts: { increment: 1 } } }); throw bad; }
    await this.db.otpChallenge.update({ where: { id: c.id }, data: { consumedAt: new Date() } });
    return c.purpose;
  }

  // ── sign-up / sign-in ──
  async register(name: string, rawEmail: string, password: string) {
    const email = this.norm(rawEmail);
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing?.emailVerified) { // same response as a new sign-up, so the form can't be used to probe which emails have accounts
      await this.mail.email(email, "You already have an account", `Someone (hopefully you) tried to create an account with this email, but you already have one. Sign in${existing.passwordHash ? "" : " with an emailed code or Google"}, or reset your password from the sign-in page.`);
      return;
    }
    const passwordHash = await hashPassword(password);
    if (existing) await this.db.user.update({ where: { id: existing.id }, data: { name, passwordHash } });
    else await this.db.user.create({ data: { email, name, passwordHash } });
    await this.sendCode(email, "signup");
  }

  /** Verifies a code, marks the email verified (creating the account for passwordless first-timers) and signs in. */
  async verifyEmail(rawEmail: string, code: string, ctx: Ctx) {
    const email = this.norm(rawEmail);
    const purpose = await this.consumeCode(email, code);
    const before = await this.db.user.findUnique({ where: { email } });
    // A password set on a not-yet-verified account may belong to whoever registered the address first, not its owner.
    // Only the sign-up flow (code sent right after that password was chosen) keeps it.
    const dropPassword = !!before && !before.emailVerified && purpose !== "signup";
    const u = await this.db.user.upsert({ where: { email }, update: { emailVerified: true, ...(dropPassword && { passwordHash: null }) }, create: { email, emailVerified: true } });
    if (u.isBlocked || u.deletedAt) throw err(403, "This account is disabled");
    return this.issue(u.id, ctx);
  }

  requestCode(rawEmail: string) { return this.sendCode(this.norm(rawEmail), "login"); }

  async login(rawEmail: string, password: string, ctx: Ctx) {
    const email = this.norm(rawEmail);
    const key = `loginfail:${email}|${ctx.ip}`;
    if ((await this.limiter.count(key)) >= 5) throw err(429, "Too many attempts, try again later");
    const u = await this.db.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, u?.passwordHash ?? "scrypt$00$00"); // always hash, so unknown emails cost the same
    if (!u || !u.passwordHash || !ok) {
      await this.limiter.hit(key, 15 * 60_000);
      throw err(401, "Incorrect email or password");
    }
    if (u.isBlocked || u.deletedAt) throw err(403, "This account is disabled");
    if (!u.emailVerified) { await this.sendCode(email, "signup").catch(() => {}); throw err(403, "Please verify your email. We've sent you a code.", "EMAIL_UNVERIFIED"); }
    await this.limiter.clear(key);
    return this.issue(u.id, ctx);
  }

  async forgot(rawEmail: string) {
    const email = this.norm(rawEmail);
    if (await this.db.user.findUnique({ where: { email }, select: { id: true } })) await this.sendCode(email, "reset");
  }

  async reset(rawEmail: string, code: string, password: string) {
    const email = this.norm(rawEmail);
    await this.consumeCode(email, code);
    const u = await this.db.user.findUnique({ where: { email } });
    if (!u) throw err(400, "That code is incorrect or has expired");
    await this.db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password), emailVerified: true } });
    await this.db.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }); // a reset signs out every device
  }

  async google(idToken: string, ctx: Ctx) {
    const g = await verifyGoogleToken(idToken);
    // Google verified this email, which proves ownership as strongly as an emailed code does, so a changed Google uid is simply re-linked.
    let u = await this.db.user.findUnique({ where: { googleUid: g.uid } }) ?? await this.db.user.findUnique({ where: { email: g.email } });
    if (!u) u = await this.db.user.create({ data: { email: g.email, name: g.name, emailVerified: true, googleUid: g.uid } });
    else if (u.googleUid !== g.uid || !u.emailVerified) {
      u = await this.db.user.update({ where: { id: u.id }, data: { googleUid: g.uid, emailVerified: true, name: u.name ?? g.name, ...(!u.emailVerified && { passwordHash: null }) } }); // see verifyEmail: an unverified account's password isn't trusted
    }
    if (u.isBlocked || u.deletedAt) throw err(403, "This account is disabled");
    return this.issue(u.id, ctx);
  }

  // ── sessions ──
  private async issue(userId: string, ctx: Ctx): Promise<Tokens> {
    const refresh = randomBytes(32).toString("base64url");
    await this.db.session.create({ data: { userId, tokenHash: sha256(refresh), ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 200), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) } });
    const access = jwt.sign({}, env.JWT_SECRET, { subject: userId, audience: "customer", expiresIn: ACCESS_TTL_S, algorithm: "HS256" });
    return { userId, access, refresh, accessMaxAgeMs: ACCESS_TTL_S * 1000, refreshMaxAgeMs: REFRESH_TTL_MS };
  }

  /** Rotating refresh; replaying a used token revokes all of that user's sessions. */
  async refresh(token: string, ctx: Ctx) {
    const s = await this.db.session.findUnique({ where: { tokenHash: sha256(token) } });
    if (!s?.userId) throw err(401, "Please sign in");
    if (s.revokedAt || s.expiresAt < new Date()) {
      if (s.revokedAt) await this.db.session.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw err(401, "Please sign in");
    }
    const u = await this.db.user.findUnique({ where: { id: s.userId } });
    if (!u || u.isBlocked || u.deletedAt) throw err(401, "Please sign in");
    await this.db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return this.issue(u.id, ctx);
  }

  async logout(token?: string) {
    if (token) await this.db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(id: string) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u || u.isBlocked || u.deletedAt) throw err(401, "Please sign in");
    return { id: u.id, email: u.email, name: u.name, phone: u.phone, hasPassword: !!u.passwordHash, google: !!u.googleUid };
  }

  async updateProfile(id: string, b: { name: string }) {
    await this.db.user.update({ where: { id }, data: { name: b.name } });
    return this.me(id);
  }

  async setPassword(id: string, current: string | undefined, password: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id } });
    if (u.passwordHash && !(current && (await verifyPassword(current, u.passwordHash)))) throw err(400, "Your current password is incorrect");
    await this.db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  }

  orders(userId: string) {
    return this.db.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { orderNumber: true, publicId: true, status: true, totalPaise: true, createdAt: true, items: { select: { title: true, qty: true }, take: 3 } } });
  }
}
