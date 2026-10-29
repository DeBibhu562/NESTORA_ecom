import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { cookieSecure, env } from "../env";
import { AuthService } from "./auth.service";
import { AllowNoMfa, Ip, Public, Staff, type StaffClaims } from "./auth.types";

const loginDto = z.object({ email: z.string().email(), password: z.string().min(1), totp: z.string().regex(/^\d{6}$/).optional() });
const codeDto = z.object({ code: z.string().regex(/^\d{6}$/) });

type Tokens = Awaited<ReturnType<AuthService["login"]>>;
const base: CookieOptions = { httpOnly: true, sameSite: "lax", secure: cookieSecure };

function setCookies(res: Response, t: Tokens) {
  res.cookie("at", t.access, { ...base, path: "/", maxAge: t.accessMaxAgeMs });
  res.cookie("rt", t.refresh, { ...base, path: "/v1/admin/auth", maxAge: t.refreshMaxAgeMs });
}

@Controller("admin/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post("login") @HttpCode(200)
  async login(@Body(new ZodPipe(loginDto)) b: z.infer<typeof loginDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.login(b.email, b.password, b.totp, req.ip, req.get("user-agent"));
    setCookies(res, t);
    return { ok: true, mfaRequired: env.REQUIRE_TOTP };
  }

  @Public() @Post("refresh") @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.refresh(req.cookies?.rt ?? "", req.ip, req.get("user-agent"));
    setCookies(res, t);
    return { ok: true };
  }

  @Public() @Post("logout") @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.rt);
    res.clearCookie("at", { ...base, path: "/" });
    res.clearCookie("rt", { ...base, path: "/v1/admin/auth" });
  }

  @AllowNoMfa() @Get("me")
  me(@Staff() s: StaffClaims) {
    return this.auth.me(s.id).then((m) => ({ ...m, perms: s.perms, mfa: s.mfa }));
  }

  @AllowNoMfa() @Post("totp/setup")
  setup(@Staff() s: StaffClaims) {
    return this.auth.totpSetup(s.id);
  }

  @AllowNoMfa() @Post("totp/enable") @HttpCode(200)
  async enable(@Body(new ZodPipe(codeDto)) b: z.infer<typeof codeDto>, @Staff() s: StaffClaims, @Ip() ip: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    setCookies(res, await this.auth.totpEnable(s.id, b.code, ip, req.get("user-agent")));
    return { ok: true };
  }
}
