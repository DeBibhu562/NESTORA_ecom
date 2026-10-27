import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { env } from "./env";
import { setup } from "./setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setup(app, env.CORS_ORIGINS);
  await app.listen(env.PORT);
}
bootstrap();
