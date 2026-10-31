import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, expect, it } from "vitest";
import { boot, client, adminLogin } from "../test-utils";

let app: INestApplication, url: string;
beforeAll(async () => { ({ app, url } = await boot()); });
afterAll(async () => { await app.close(); });

it("brands are deduplicated; hand-picked related products lead the storefront list", async () => {
  const o = client(url);
  await adminLogin(app, o, "owner@example.com", process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345");
  const a = await o.call("POST", "/admin/brands", { name: "Test Brand X" });
  const b = await o.call("POST", "/admin/brands", { name: "test brand x" });
  expect(b.body.id).toBe(a.body.id);

  const { items } = (await o.call("GET", "/admin/products?status=ACTIVE&limit=3")).body as { items: { id: string; title: string }[] };
  const [p, x] = items as [typeof items[0], typeof items[0]];
  expect((await o.call("PUT", `/admin/products/${p.id}/related`, { ids: [p.id] })).status).toBe(400);
  expect((await o.call("PUT", `/admin/products/${p.id}/related`, { ids: ["nope"] })).status).toBe(400);
  expect((await o.call("PUT", `/admin/products/${p.id}/related`, { ids: [x.id] })).status).toBe(200);
  try {
    const slug = (await o.call("GET", `/admin/products/${p.id}`)).body.slug;
    expect((await client(url).call("GET", `/catalog/products/${slug}`)).body.related[0].id).toBe(x.id);
  } finally { await o.call("PUT", `/admin/products/${p.id}/related`, { ids: [] }); }
});
