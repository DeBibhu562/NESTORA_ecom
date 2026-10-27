import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

/** RFC 7807 problem+json for every error. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly log = new Logger("errors");

  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let body: Record<string, unknown> = { title: "Internal error" };

    if (e instanceof HttpException) {
      status = e.getStatus();
      const r = e.getResponse();
      body = typeof r === "string" ? { title: r } : { title: e.message, ...(r as object) };
      delete body.statusCode;
      if (body.message && !body.detail) body.detail = body.message;
      delete body.message;
      delete body.error;
    } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
      const map: Record<string, [number, string]> = {
        P2002: [409, "Already exists"], P2003: [409, "Referenced by other records"], P2004: [409, "Constraint violated"], P2025: [404, "Not found"],
      };
      const [s, title] = map[e.code] ?? [500, "Database error"];
      status = s;
      body = { title, ...(status < 500 ? { detail: JSON.stringify(e.meta ?? {}) } : {}) };
    }
    if (status >= 500) this.log.error(e instanceof Error ? e.stack : String(e));
    res.status(status).type("application/problem+json").json({ status, ...body });
  }
}
