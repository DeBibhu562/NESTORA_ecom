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
  // Cookies are Secure (HTTPS-only) in production. Set COOKIE_SECURE=false only while serving over plain http (e.g. a bare IP); use HTTPS as soon as there is a domain.
  COOKIE_SECURE: bool.optional(),
  // Number of reverse proxies in front of the API (Caddy = 1), so rate limits see the visitor's IP rather than the proxy's.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  UPLOAD_DIR: z.string().default("uploads"),
  // Email: Gmail works with an app password, e.g. smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465. Unset = emails are only logged.
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("Nestora <no-reply@localhost>"),
  // Google sign-in is verified against this Firebase project; unset = Google login is off.
  FIREBASE_PROJECT_ID: z.string().optional(),
  // WhatsApp Cloud API; unset = WhatsApp messages are skipped.
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  // Razorpay is optional: without keys the store runs COD-only.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Shiprocket: unset = staff enter courier and AWB by hand. Webhook token is sent by Shiprocket in the x-api-key header.
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP: z.string().default("Primary"), // pickup location name as saved in your Shiprocket panel
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),
  SITE_URL: z.string().url().default("http://localhost:3020"), // used in links inside emails/messages
  PUBLIC_API_URL: z.string().url().default("http://localhost:4010"),
});

// Fail fast at boot on bad config
export const env = schema.parse(process.env);
export const cookieSecure = env.COOKIE_SECURE ?? process.env.NODE_ENV === "production";
