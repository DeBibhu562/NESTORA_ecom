import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export type StaffClaims = { id: string; perms: string[]; mfa: boolean };
export type AuthedRequest = Request & { staff?: StaffClaims };

export const Public = () => SetMetadata("public", true);
/** Allow sessions that haven't completed MFA setup (login, TOTP enrolment, me, logout). */
export const AllowNoMfa = () => SetMetadata("allowNoMfa", true);
export const Perm = (...p: string[]) => SetMetadata("perms", p);

export const Staff = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().staff!);
export const Ip = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>().ip);
