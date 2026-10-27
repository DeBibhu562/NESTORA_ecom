// shortcut: per-instance fixed window; replace with a Redis-backed limiter when running >1 API instance (hardening epic).
export class RateLimit {
  private readonly hits = new Map<string, { n: number; reset: number }>();
  constructor(private readonly max: number, private readonly windowMs: number) {}

  /** true when the call is allowed. */
  allow(key: string, now = Date.now()) {
    const h = this.hits.get(key);
    if (!h || now >= h.reset) {
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (now >= v.reset) this.hits.delete(k);
      this.hits.set(key, { n: 1, reset: now + this.windowMs });
      return true;
    }
    return ++h.n <= this.max;
  }
}
