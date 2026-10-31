import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

/** One place for outbound messages. Each channel is a no-op until its credentials are in the env, so enabling one is config only. */
@Injectable()
export class Notifier {
  private readonly log = new Logger("Notifier");
  /** Captured instead of sent when NODE_ENV=test, so tests can read OTP codes. */
  readonly outbox: { to: string; subject: string; text: string }[] = [];
  private readonly smtp: Transporter | null = env.SMTP_URL && process.env.NODE_ENV !== "test" ? nodemailer.createTransport(env.SMTP_URL) : null;

  /** Returns false when delivery failed or no transport is configured. */
  async email(to: string, subject: string, text: string): Promise<boolean> {
    if (process.env.NODE_ENV === "test") { this.outbox.push({ to, subject, text }); return true; }
    if (!this.smtp) { this.log.warn(`SMTP_URL not set; email to ${to} not sent: ${subject}\n${text}`); return false; }
    try { await this.smtp.sendMail({ from: env.MAIL_FROM, to, subject, text }); return true; }
    catch (e) { this.log.error(`email to ${to} failed: ${e}`); return false; }
  }

  /** Tells the shop owner something needs attention. A no-op until ADMIN_EMAIL is set. */
  async admin(subject: string, text: string): Promise<boolean> {
    if (!env.ADMIN_EMAIL) return false;
    const to = env.ADMIN_EMAIL.split(",").map((s) => s.trim()).filter(Boolean).join(",");
    return this.email(to, subject, text);
  }

  /** `phone` in E.164 (+91…). Free-form text only works inside WhatsApp's 24h window; switch to approved templates once the account is live. */
  async whatsapp(phone: string, text: string): Promise<boolean> {
    if (process.env.NODE_ENV === "test" || !env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) return false;
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${env.WHATSAPP_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/\D/g, ""), type: "text", text: { body: text } }), signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) this.log.error(`whatsapp to ${phone} failed: ${res?.status}`);
    return !!res?.ok;
  }
}
