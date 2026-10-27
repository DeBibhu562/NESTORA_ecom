import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(4010),
  CORS_ORIGINS: z.string().default("http://localhost:3020,http://localhost:3001"),
  // Staff must have TOTP enabled to use the admin API (plan §4.3). Off by default outside production.
  REQUIRE_TOTP: bool.default(process.env.NODE_ENV === "production" ? "true" : "false"),
  STOCK_ALERT_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10), // per IP; raise in dev/e2e
  UPLOAD_DIR: z.string().default("uploads"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4010"),
});

// Fail fast at boot on bad config
export const env = schema.parse(process.env);
