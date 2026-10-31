import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { PrismaService } from "../prisma.service";
import type { AuthedRequest } from "./auth.types";

export const hasPerm = (perms: string[], need: string) => perms.includes("*") || perms.includes(need);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: PrismaService) {}

  async canActivate(ctx: ExecutionContext) {
    const get = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    if (get<boolean>("public")) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = req.cookies?.at as string | undefined;
    if (!token) throw new UnauthorizedException("Not signed in");
    let id: string;
    try {
      id = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], audience: "staff" }).sub as string;
    } catch {
      throw new UnauthorizedException("Session expired");
    }
    // read live, so deactivating or demoting someone takes effect on their next request, not when the token expires
    const staff = await this.db.staffUser.findUnique({ where: { id }, select: { isActive: true, role: { select: { permissions: { select: { permission: true } } } } } });
    if (!staff?.isActive) throw new UnauthorizedException("Session expired");
    req.staff = { id, perms: staff.role.permissions.map((p) => p.permission) };

    const need = get<string[]>("perms") ?? [];
    if (!need.every((p) => hasPerm(req.staff!.perms, p))) throw new ForbiddenException("Missing permission");
    return true;
  }
}
