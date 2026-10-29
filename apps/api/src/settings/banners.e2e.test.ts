import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, it } from "vitest";
import { boot, client } from "../test-utils";

let app: INestApplication, url: string;
beforeAll(async () => { ({ app, url } = await boot()); });
afterAll(async () => { await app.close(); });

it("banners: admin CRUD, only live slides are public, off-site links are rejected", async () => {
  const o = client(url);
  await o.call("POST", "/admin/auth/login", { email: "owner@example.com", password: process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345" });
  const body = { title: "Test slide", subtitle: null, ctaLabel: "Go", imageUrl: "http://localhost:4010/uploads/seed/hero.svg", link: "/c/bottles", position: 1, isActive: true };
  expect((await o.call("POST", "/admin/banners", { ...body, link: "https://evil.example" })).status).toBe(400);
  const made = await o.call("POST", "/admin/banners", body);
  expect(made.status).toBe(201);
  const live = await client(url).call("GET", "/catalog/banners");
  expect(live.body.some((b: { id: string }) => b.id === made.body.id)).toBe(true);
  await o.call("PUT", `/admin/banners/${made.body.id}`, { ...body, isActive: false });
  expect((await client(url).call("GET", "/catalog/banners")).body.some((b: { id: string }) => b.id === made.body.id)).toBe(false);
  expect((await o.call("DELETE", `/admin/banners/${made.body.id}`)).status).toBe(204);
});
