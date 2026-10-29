import { Body, Controller, Get, HttpCode, Patch, Post, Put, Req, Res } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { Public } from "../auth/auth.types";
import { Limiter } from "../common/limiter.service";
import { CartService } from "../cart/cart.service";
import { cartCookie } from "../cart/cart.controller";
import { ZodPipe } from "../common/zod.pipe";
import { CustomerAuthService, requireUser, type Tokens } from "./customer-auth.service";
import { googleEnabled } from "./firebase";
import { cookieSecure } from "../env";

const secure = cookieSecure;
const base: CookieOptions = { httpOnly: true, sameSite: "lax", secure };
const email = z.string().trim().toLowerCase().email().max(120);
const password = z.string().min(8, "Use at least 8 characters").max(128);
const code = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
const registerDto = z.object({ name: z.string().trim().min(1).max(80), email, password });
const emailDto = z.object({ email });
const verifyDto = z.object({ email, code });
const loginDto = z.object({ email, password: z.string().min(1).max(128) });
const resetDto = z.object({ email, code, password });
const googleDto = z.object({ idToken: z.string().min(20).max(5000) });
const profileDto = z.object({ name: z.string().trim().min(1).max(80) });
const passwordDto = z.object({ current: z.string().max(128).optional(), password });

const ctx = (req: Request) => ({ ip: req.ip, userAgent: req.headers["user-agent"] });

function setCookies(res: Response, t: Tokens) {
  res.cookie("cu", t.access, { ...base, path: "/", maxAge: t.accessMaxAgeMs });
  res.cookie("cr", t.refresh, { ...base, path: "/v1/account", maxAge: t.refreshMaxAgeMs });
}

@Public() // customer routes do their own cookie auth; the staff guard must not apply
@Controller("account")
export class CustomerAuthController {
  constructor(private readonly svc: CustomerAuthService, private readonly limiter: Limiter, private readonly cart: CartService) {}

  private throttle(req: Request) { return this.limiter.guard(`acct:${req.ip}`, 60, 60_000); }

  /** Signing in adopts the browser's guest cart (merging with any cart the account already has). */
  private async signedIn(t: Tokens, req: Request, res: Response) {
    setCookies(res, t);
    const ct = await this.cart.attach(t.userId, req.cookies?.ct);
    if (ct) res.cookie("ct", ct, cartCookie);
    return this.svc.me(t.userId);
  }

  @Get("config") config() { return { google: googleEnabled() }; }

  @Post("register") @HttpCode(200)
  async register(@Body(new ZodPipe(registerDto)) b: z.infer<typeof registerDto>, @Req() req: Request) { await this.throttle(req); await this.svc.register(b.name, b.email, b.password); return { sent: true }; }

  /** Sends a sign-in / verification code. Same response whether or not the email is known. */
  @Post("code") @HttpCode(200)
  async requestCode(@Body(new ZodPipe(emailDto)) b: z.infer<typeof emailDto>, @Req() req: Request) { await this.throttle(req); await this.svc.requestCode(b.email); return { sent: true }; }

  @Post("verify") @HttpCode(200)
  async verify(@Body(new ZodPipe(verifyDto)) b: z.infer<typeof verifyDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.throttle(req); return this.signedIn(await this.svc.verifyEmail(b.email, b.code, ctx(req)), req, res);
  }

  @Post("login") @HttpCode(200)
  async login(@Body(new ZodPipe(loginDto)) b: z.infer<typeof loginDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.throttle(req); return this.signedIn(await this.svc.login(b.email, b.password, ctx(req)), req, res);
  }

  @Post("google") @HttpCode(200)
  async google(@Body(new ZodPipe(googleDto)) b: z.infer<typeof googleDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.throttle(req); return this.signedIn(await this.svc.google(b.idToken, ctx(req)), req, res);
  }

  @Post("forgot") @HttpCode(200)
  async forgot(@Body(new ZodPipe(emailDto)) b: z.infer<typeof emailDto>, @Req() req: Request) { await this.throttle(req); await this.svc.forgot(b.email); return { sent: true }; }

  @Post("reset") @HttpCode(200)
  async reset(@Body(new ZodPipe(resetDto)) b: z.infer<typeof resetDto>, @Req() req: Request) { await this.throttle(req); await this.svc.reset(b.email, b.code, b.password); return { ok: true }; }

  @Post("refresh") @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    setCookies(res, await this.svc.refresh(req.cookies?.cr ?? "", ctx(req))); return { ok: true };
  }

  @Post("logout") @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.svc.logout(req.cookies?.cr);
    res.clearCookie("cu", { ...base, path: "/" }); res.clearCookie("cr", { ...base, path: "/v1/account" });
    return { ok: true };
  }

  @Get("me") me(@Req() req: Request) { return this.svc.me(requireUser(req)); }
  @Patch("me") profile(@Body(new ZodPipe(profileDto)) b: z.infer<typeof profileDto>, @Req() req: Request) { return this.svc.updateProfile(requireUser(req), b); }
  @Put("password") @HttpCode(200)
  async password(@Body(new ZodPipe(passwordDto)) b: z.infer<typeof passwordDto>, @Req() req: Request) { await this.svc.setPassword(requireUser(req), b.current, b.password); return { ok: true }; }
  @Get("orders") orders(@Req() req: Request) { return this.svc.orders(requireUser(req)); }
}
