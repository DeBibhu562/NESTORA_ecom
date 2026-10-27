import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { setup } from "../setup";
import type { INestApplication } from "@nestjs/common";

let app: INestApplication;
beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  setup(app, "http://localhost:3020");
  await app.listen(0);
});
afterAll(() => app.close());

it("GET /v1/health reports db up and sets security headers", async () => {
  const res = await fetch(`${await app.getUrl()}/v1/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok", db: true });
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});
