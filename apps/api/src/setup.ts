import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { resolve } from "node:path";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ProblemFilter } from "./common/problem.filter";
import { env } from "./env";

export function setup(app: INestApplication, corsOrigins: string) {
  app.setGlobalPrefix("v1");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // uploaded images are embedded cross-origin
  app.use(cookieParser());
  app.useGlobalFilters(new ProblemFilter());
  app.enableCors({ origin: corsOrigins.split(","), credentials: true });
  (app as NestExpressApplication).useStaticAssets(resolve(env.UPLOAD_DIR), { prefix: "/uploads", maxAge: "7d" });
  app.enableShutdownHooks();
}
