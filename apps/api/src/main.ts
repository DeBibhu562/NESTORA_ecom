import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { env } from "./env";
import { setup } from "./setup";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY);
  setup(app, env.CORS_ORIGINS);
  await app.listen(env.PORT);
}
bootstrap();
