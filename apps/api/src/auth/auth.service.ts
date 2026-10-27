import { HttpException, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../audit/audit.service";
import { env } from "../env";
import { decrypt, encrypt, newTotpSecret, sha256, verifyPassword, verifyTotp } from "./crypto";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 8 * 3600 * 1000;
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  // shortcut: per-instance counters; move to Redis rate limiting with the hardening epic or when running >1 API instance
  private readonly fails = new Map<string, { n: number; since: number }>();

  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  private throttle(key: string) {
    const f = this.fails.get(key);
    if (f && Date.now() - f.since < WINDOW_MS && f.n >= MAX_FAILS) throw new HttpException("Too many attempts, try later", 429);
  }
  private fail(key: string): never {
    const f = this.fails.get(key);
    this.fails.set(key, !f || Date.now() - f.since >= WINDOW_MS ? { n: 1, since: Date.now() } : { n: f.n + 1, since: f.since });
    throw new UnauthorizedException("Invalid credentials");
  }

  async login(email: string, password: string, totp: string | undefined, ip: string | undefined, userAgent: string | undefined) {
    const key = `${email.toLowerCase()}|${ip}`;
    this.throttle(key);
    const staff = await this.db.staffUser.findUnique({ where: { email: email.toLowerCase() }, include: { role: { include: { permissions: true } } } });
    // always run a hash comparison to keep timing similar for unknown emails
    const ok = await verifyPassword(password, staff?.passwordHash ?? "scrypt$00$00");
    if (!staff || !staff.isActive || !ok) this.fail(key);
    if (staff.totpEnabled) {
      if (!totp) throw new UnauthorizedException({ title: "Authenticator code required", code: "TOTP_REQUIRED" });
      if (!verifyTotp(decrypt(staff.totpSecret!), totp)) this.fail(key);
    }
    this.fails.delete(key);
    await this.db.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log(staff.id, "auth.login", "StaffUser", staff.id, undefined, ip);
    return this.issue(staff.id, staff.role.permissions.map((p) => p.permission), staff.totpEnabled, ip, userAgent);
  }

  private async issue(staffId: string, perms: string[], mfa: boolean, ip?: string, userAgent?: string) {
    const refresh = randomBytes(32).toString("base64url");
    await this.db.session.create({ data: { staffId, tokenHash: sha256(refresh), ip, userAgent, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) } });
    const access = jwt.sign({ perms, mfa }, env.JWT_SECRET, { subject: staffId, expiresIn: ACCESS_TTL_S, algorithm: "HS256" });
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
    const staff = await this.db.staffUser.findUnique({ where: { id: s.staffId }, include: { role: { include: { permissions: true } } } });
    if (!staff?.isActive) throw new UnauthorizedException("Invalid session");
    await this.db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return this.issue(staff.id, staff.role.permissions.map((p) => p.permission), staff.totpEnabled, ip, userAgent);
  }

  async logout(token: string | undefined) {
    if (token) await this.db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(staffId: string) {
    const s = await this.db.staffUser.findUniqueOrThrow({ where: { id: staffId }, include: { role: true } });
    return { id: s.id, email: s.email, name: s.name, role: s.role.name, totpEnabled: s.totpEnabled };
  }

  async totpSetup(staffId: string) {
    const s = await this.db.staffUser.findUniqueOrThrow({ where: { id: staffId } });
    if (s.totpEnabled) throw new HttpException("TOTP already enabled", 409);
    const secret = newTotpSecret();
    await this.db.staffUser.update({ where: { id: staffId }, data: { totpSecret: encrypt(secret) } });
    return { secret, otpauthUrl: `otpauth://totp/Admin:${encodeURIComponent(s.email)}?secret=${secret}&issuer=Admin` };
  }

  /** Confirms the first code, enables TOTP and returns fresh tokens carrying mfa=true. */
  async totpEnable(staffId: string, code: string, ip?: string, userAgent?: string) {
    const s = await this.db.staffUser.findUniqueOrThrow({ where: { id: staffId }, include: { role: { include: { permissions: true } } } });
    if (!s.totpSecret || s.totpEnabled || !verifyTotp(decrypt(s.totpSecret), code)) throw new UnauthorizedException("Invalid code");
    await this.db.staffUser.update({ where: { id: staffId }, data: { totpEnabled: true } });
    await this.audit.log(staffId, "auth.totp_enabled", "StaffUser", staffId, undefined, ip);
    return this.issue(staffId, s.role.permissions.map((p) => p.permission), true, ip, userAgent);
  }
}
