import { HttpException, Injectable, OnModuleDestroy } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import Redis from "ioredis";
import { env } from "../env";

/**
 * Fixed-window counters shared by every API instance through Redis. If Redis is unreachable it falls back to per-process
 * counters, so a Redis outage weakens limits to "per server" instead of locking everyone out (or failing open entirely).
 */
@Injectable()
export class Limiter implements OnModuleDestroy {
  private readonly redis = new Redis(env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, commandTimeout: 300, retryStrategy: (n) => Math.min(n * 200, 5000) });
  private readonly local = new Map<string, { n: number; reset: number }>();
  private readonly ns = process.env.NODE_ENV === "test" ? `${randomBytes(4).toString("hex")}:` : ""; // test runs must not inherit each other's counts

  constructor() {
    this.redis.on("error", () => {}); // outages are handled per call below
    this.redis.connect().catch(() => {});
  }
  onModuleDestroy() { this.redis.disconnect(); }

  /** Counts one hit and returns the hits so far in the current window. */
  async hit(key: string, windowMs: number): Promise<number> {
    const k = `rl:${this.ns}${key}`;
    try {
      await this.redis.set(k, 0, "PX", windowMs, "NX"); // the TTL is set together with the key, so a crash can't leave a counter that never expires
      return await this.redis.incr(k);
    } catch {
      const now = Date.now(), e = this.local.get(k);
      if (this.local.size > 10_000) for (const [lk, v] of this.local) if (now >= v.reset) this.local.delete(lk);
      if (!e || now >= e.reset) { this.local.set(k, { n: 1, reset: now + windowMs }); return 1; }
      return ++e.n;
    }
  }

  async count(key: string): Promise<number> {
    const k = `rl:${this.ns}${key}`;
    try { return Number(await this.redis.get(k)) || 0; }
    catch { const e = this.local.get(k); return e && Date.now() < e.reset ? e.n : 0; }
  }

  async clear(key: string) {
    const k = `rl:${this.ns}${key}`;
    this.local.delete(k);
    await this.redis.del(k).catch(() => {});
  }

  /** Throws 429 once `key` has been hit more than `max` times within the window. */
  async guard(key: string, max: number, windowMs: number, title = "Too many requests, please wait a minute") {
    if ((await this.hit(key, windowMs)) > max) throw new HttpException({ title }, 429);
  }
}
