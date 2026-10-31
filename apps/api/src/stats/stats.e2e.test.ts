import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, it } from "vitest";
import { boot, client, adminLogin } from "../test-utils";

let app: INestApplication, url: string;
beforeAll(async () => { ({ app, url } = await boot()); });
afterAll(async () => { await app.close(); });

it("returns a full-length series and rejects anonymous callers and bad ranges", async () => {
  expect((await client(url).call("GET", "/admin/stats/overview")).status).toBe(401);
  const o = client(url);
  await adminLogin(app, o, "owner@example.com", process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345");
  const r = await o.call("GET", "/admin/stats/overview?range=7d");
  expect(r.status).toBe(200);
  expect(r.body.series).toHaveLength(7);
  expect(typeof r.body.revenuePaise).toBe("number");
  expect((await o.call("GET", "/admin/stats/overview?range=1y")).status).toBe(400);
  const orders = await o.call("GET", "/admin/orders?from=2020-01-01&to=2099-01-01");
  expect(orders.status).toBe(200);
  if (orders.body.items.length) expect(orders.body.items[0]).toHaveProperty("name");
  const cust = await o.call("GET", "/admin/customers?limit=5");
  expect(cust.status).toBe(200);
  expect(cust.body).toHaveProperty("total");
});
