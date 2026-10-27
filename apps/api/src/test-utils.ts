import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { setup } from "./setup";

export async function boot() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = mod.createNestApplication();
  setup(app, "http://localhost:3020");
  await app.listen(0);
  return { app, url: await app.getUrl() };
}

/** Minimal cookie-aware JSON client. */
export function client(url: string) {
  const jar = new Map<string, string>();
  const call = async (method: string, path: string, body?: unknown, raw?: FormData) => {
    const res = await fetch(`${url}/v1${path}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, v] = kv!.split("=");
      if (v) jar.set(k!, v); else jar.delete(k!);
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)) jar.delete(k!);
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, jar };
  };
  return { call, jar };
}
