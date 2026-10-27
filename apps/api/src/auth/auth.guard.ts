import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { env } from "../env";
import type { AuthedRequest, StaffClaims } from "./auth.types";

export const hasPerm = (perms: string[], need: string) => perms.includes("*") || perms.includes(need);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const get = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    if (get<boolean>("public")) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = req.cookies?.at as string | undefined;
    if (!token) throw new UnauthorizedException("Not signed in");
    let claims: StaffClaims;
    try {
      const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
      claims = { id: p.sub!, perms: p.perms, mfa: !!p.mfa };
    } catch {
      throw new UnauthorizedException("Session expired");
    }
    req.staff = claims;

    if (env.REQUIRE_TOTP && !claims.mfa && !get<boolean>("allowNoMfa"))
      throw new ForbiddenException({ title: "MFA setup required", code: "MFA_SETUP_REQUIRED" });

    const need = get<string[]>("perms") ?? [];
    if (!need.every((p) => hasPerm(claims.perms, p))) throw new ForbiddenException("Missing permission");
    return true;
  }
}
