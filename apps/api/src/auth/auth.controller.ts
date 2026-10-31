import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { ZodPipe } from "../common/zod.pipe";
import { cookieSecure } from "../env";
import { AuthService } from "./auth.service";
import { Public, Staff, type StaffClaims } from "./auth.types";

const passwordDto = z.object({ current: z.string().min(1), password: z.string().min(12).max(128) });
const loginDto = z.object({ email: z.string().email(), password: z.string().min(1), otp: z.string().regex(/^\d{6}$/).optional() });

type Tokens = Awaited<ReturnType<AuthService["refresh"]>> & { device?: string };
const base: CookieOptions = { httpOnly: true, sameSite: "lax", secure: cookieSecure };

function setCookies(res: Response, t: Tokens) {
  res.cookie("at", t.access, { ...base, path: "/", maxAge: t.accessMaxAgeMs });
  res.cookie("rt", t.refresh, { ...base, path: "/v1/admin/auth", maxAge: t.refreshMaxAgeMs });
  if (t.device) res.cookie("dt", t.device, { ...base, path: "/v1/admin/auth", maxAge: 30 * 86400_000 });
}

@Controller("admin/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post("login") @HttpCode(200)
  async login(@Body(new ZodPipe(loginDto)) b: z.infer<typeof loginDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.login(b.email, b.password, b.otp, req.cookies?.dt, req.ip, req.get("user-agent"));
    setCookies(res, t);
    return { ok: true };
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

  @Get("me")
  me(@Staff() s: StaffClaims) {
    return this.auth.me(s.id).then((m) => ({ ...m, perms: s.perms }));
  }

  @Post("password") @HttpCode(200)
  async password(@Body(new ZodPipe(passwordDto)) b: z.infer<typeof passwordDto>, @Staff() s: StaffClaims, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    setCookies(res, await this.auth.changePassword(s.id, b.current, b.password, req.ip, req.get("user-agent")));
    return { ok: true };
  }
}
