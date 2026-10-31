import { HttpException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../audit/audit.service";
import { Limiter } from "../common/limiter.service";
import { env } from "../env";
import { Notifier } from "../notify/notifier.service";
import { hashPassword, sha256, verifyPassword } from "./crypto";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 8 * 3600 * 1000;
const MAX_FAILS = 5;
const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const DEVICE_TTL_MS = 30 * 86400_000;
const MAX_FAILS_PER_ACCOUNT = 20;
const MAX_CODES_PER_HOUR = process.env.NODE_ENV === "test" ? 1000 : 5;
const CODE_COOLDOWN_MS = process.env.NODE_ENV === "test" ? 0 : 30_000;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService, private readonly limiter: Limiter, private readonly notifier: Notifier) {}

  // per email+IP stops one machine; the per-email counter stops guessing spread over many IPs
  private async throttle(key: string, email: string) {
    if ((await this.limiter.count(key)) >= MAX_FAILS || (await this.limiter.count(`stafffail:${email}`)) >= MAX_FAILS_PER_ACCOUNT) throw new HttpException("Too many attempts, try later", 429);
  }
  private async fail(key: string, email: string): Promise<never> {
    await Promise.all([this.limiter.hit(key, WINDOW_MS), this.limiter.hit(`stafffail:${email}`, WINDOW_MS)]);
    throw new UnauthorizedException("Invalid credentials");
  }

  private codeHash = (email: string, code: string) => createHmac("sha256", env.JWT_SECRET).update(`staff|${email}|${code}`).digest("hex");

  private async sendCode(email: string) {
    const target = `staff:${email}`;
    const recent = await this.db.otpChallenge.findMany({ where: { target, createdAt: { gt: new Date(Date.now() - 3600_000) } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (recent.length >= MAX_CODES_PER_HOUR || (recent[0] && Date.now() - recent[0].createdAt.getTime() < CODE_COOLDOWN_MS)) throw new HttpException("A code was sent recently. Check your inbox or wait a little.", 429);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.db.otpChallenge.updateMany({ where: { target, consumedAt: null }, data: { consumedAt: new Date() } });
    await this.db.otpChallenge.create({ data: { target, purpose: "staff", codeHash: this.codeHash(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    if (!(await this.notifier.email(email, `Admin sign-in code: ${code}`, `Your admin sign-in code is ${code}. It expires in 10 minutes. If this wasn't you, change your password.`)))
      throw new HttpException("Could not send the code, try again", 502);
  }

  private async checkCode(email: string, code: string) {
    const c = await this.db.otpChallenge.findFirst({ where: { target: `staff:${email}`, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!c || c.attempts >= OTP_MAX_ATTEMPTS) return false;
    if (!timingSafeEqual(Buffer.from(this.codeHash(email, code)), Buffer.from(c.codeHash))) {
      await this.db.otpChallenge.update({ where: { id: c.id }, data: { attempts: { increment: 1 } } });
      return false;
    }
    await this.db.otpChallenge.update({ where: { id: c.id }, data: { consumedAt: new Date() } });
    return true;
  }

  /** Password first; then an emailed code unless this browser's device cookie was code-verified in the last 30 days. */
  async login(email: string, password: string, otp: string | undefined, device: string | undefined, ip: string | undefined, userAgent: string | undefined) {
    email = email.toLowerCase();
    const key = `stafffail:${email}|${ip}`;
    await this.throttle(key, email);
    const staff = await this.db.staffUser.findUnique({ where: { email } });
    // always run a hash comparison to keep timing similar for unknown emails
    const ok = await verifyPassword(password, staff?.passwordHash ?? "scrypt$00$00");
    if (!staff || !staff.isActive || !ok) return this.fail(key, email);

    const known = device && await this.db.trustedDevice.findFirst({ where: { staffId: staff.id, tokenHash: sha256(device), verifiedAt: { gt: new Date(Date.now() - DEVICE_TTL_MS) } } });
    let newDevice: string | undefined;
    if (!known) {
      if (!otp) {
        await this.sendCode(email);
        throw new UnauthorizedException({ title: "We emailed you a sign-in code", code: "OTP_REQUIRED" });
      }
      if (!(await this.checkCode(email, otp))) return this.fail(key, email);
      newDevice = randomBytes(32).toString("base64url");
      const tokenHash = sha256(newDevice);
      await this.db.trustedDevice.deleteMany({ where: { verifiedAt: { lt: new Date(Date.now() - DEVICE_TTL_MS) } } });
      await this.db.trustedDevice.create({ data: { staffId: staff.id, tokenHash, verifiedAt: new Date() } });
    }
    await this.limiter.clear(key);
    await this.db.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log(staff.id, "auth.login", "StaffUser", staff.id, undefined, ip);
    return { ...(await this.issue(staff.id, ip, userAgent)), device: newDevice };
  }

  private async issue(staffId: string, ip?: string, userAgent?: string) {
    const refresh = randomBytes(32).toString("base64url");
    await this.db.session.create({ data: { staffId, tokenHash: sha256(refresh), ip, userAgent, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) } });
    const access = jwt.sign({}, env.JWT_SECRET, { subject: staffId, audience: "staff", expiresIn: ACCESS_TTL_S, algorithm: "HS256" });
    return { access, refresh, accessMaxAgeMs: ACCESS_TTL_S * 1000, refreshMaxAgeMs: REFRESH_TTL_MS };
  }

  /** Rotating refresh; presenting an already-used token revokes every session of that user (theft signal). */
  async refresh(token: string, ip?: string, userAgent?: string) {
    const s = await this.db.session.findUnique({ where: { tokenHash: sha256(token) } });
    if (!s?.staffId) throw new UnauthorizedException("Invalid session");
    if (s.revokedAt || s.expiresAt < new Date()) {
      if (s.revokedAt) await this.db.session.updateMany({ where: { staffId: s.staffId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException("Invalid session");
    }
    const staff = await this.db.staffUser.findUnique({ where: { id: s.staffId } });
    if (!staff?.isActive) throw new UnauthorizedException("Invalid session");
    await this.db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return this.issue(staff.id, ip, userAgent);
  }

  async logout(token: string | undefined) {
    if (token) await this.db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(staffId: string) {
    const s = await this.db.staffUser.findUniqueOrThrow({ where: { id: staffId }, include: { role: true } });
    return { id: s.id, email: s.email, name: s.name, role: s.role.name };
  }

  /** Revokes every session and trusted device, then signs this browser back in on a fresh session; the next sign-in anywhere else needs a new code. */
  async changePassword(staffId: string, current: string, next: string, ip?: string, userAgent?: string) {
    const s = await this.db.staffUser.findUniqueOrThrow({ where: { id: staffId } });
    if (!(await verifyPassword(current, s.passwordHash))) throw new UnauthorizedException("Current password is incorrect");
    await this.db.$transaction([
      this.db.staffUser.update({ where: { id: staffId }, data: { passwordHash: await hashPassword(next) } }),
      this.db.session.updateMany({ where: { staffId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.db.trustedDevice.deleteMany({ where: { staffId } }),
    ]);
    await this.audit.log(staffId, "auth.password_changed", "StaffUser", staffId, undefined, ip);
    return this.issue(staffId, ip, userAgent);
  }
}
