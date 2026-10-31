import { Injectable, Logger } from "@nestjs/common";
import { env } from "../env";
import { Notifier } from "../notify/notifier.service";
import { PrismaService } from "../prisma.service";

export type Template = "PLACED" | "CONFIRMED" | "PACKED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "REFUND_PROCESSED" | "RETURN_REQUESTED" | "RETURN_APPROVED" | "RETURN_REJECTED" | "RETURN_RECEIVED" | "REVIEW_REQUEST";
type Ctx = { orderNumber: string; link: string; total: string; courier?: string | null; awb?: string | null; trackingUrl?: string | null; note?: string; amount?: string; returnNumber?: string; windowEnds?: string; cod: boolean };

const rs = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/** All customer wording lives here. Each entry returns [subject, body]. */
const COPY: Record<Template, (c: Ctx) => [string, string]> = {
  PLACED: (c) => [`Order ${c.orderNumber} confirmed`, `Thanks for your order ${c.orderNumber}! Total ${c.total}${c.cod ? " (pay on delivery)" : " (paid)"}. Track it: ${c.link}`],
  CONFIRMED: (c) => [`We're preparing order ${c.orderNumber}`, `Good news: order ${c.orderNumber} is confirmed and being prepared. Track it: ${c.link}`],
  PACKED: (c) => [`Order ${c.orderNumber} is packed`, `Order ${c.orderNumber} is packed and waiting for the courier. Track it: ${c.link}`],
  SHIPPED: (c) => [`Order ${c.orderNumber} has shipped`, `Order ${c.orderNumber} is on its way${c.courier ? ` with ${c.courier}` : ""}${c.awb ? ` (AWB ${c.awb})` : ""}.${c.trackingUrl ? ` Courier tracking: ${c.trackingUrl}.` : ""} Track it: ${c.link}`],
  OUT_FOR_DELIVERY: (c) => [`Order ${c.orderNumber} is out for delivery`, `Your order ${c.orderNumber} is out for delivery today.${c.cod ? ` Please keep ${c.total} ready.` : ""} Track it: ${c.link}`],
  DELIVERED: (c) => [`Order ${c.orderNumber} delivered`, `Your order ${c.orderNumber} has been delivered. Your invoice and our return option are on your order page until ${c.windowEnds}: ${c.link}`],
  CANCELLED: (c) => [`Order ${c.orderNumber} cancelled`, `Order ${c.orderNumber} has been cancelled${c.note ? ` (${c.note})` : ""}.${c.cod ? "" : " Any payment you made will be refunded to the original method in 5–7 working days."} Details: ${c.link}`],
  REFUND_PROCESSED: (c) => [`Refund of ${c.amount} for ${c.orderNumber}`, `We've refunded ${c.amount} for ${c.returnNumber ?? c.orderNumber}.${c.note ? ` ${c.note}` : ""} It can take 5–7 working days to show in your account. Details: ${c.link}`],
  RETURN_REQUESTED: (c) => [`Return ${c.returnNumber} received`, `We've received your return request ${c.returnNumber} for order ${c.orderNumber}. We'll review it within 1 working day. Status: ${c.link}`],
  RETURN_APPROVED: (c) => [`Return ${c.returnNumber} approved`, `Your return ${c.returnNumber} is approved. ${c.note ?? "We will arrange a pickup and email you the details."} Status: ${c.link}`],
  RETURN_REJECTED: (c) => [`Return ${c.returnNumber} could not be approved`, `We couldn't approve return ${c.returnNumber}${c.note ? `: ${c.note}` : "."} Status: ${c.link}`],
  RETURN_RECEIVED: (c) => [`We received your return ${c.returnNumber}`, `We've received the items for return ${c.returnNumber}. Your refund is being processed. Status: ${c.link}`],
  REVIEW_REQUEST: (c) => [`How was your order ${c.orderNumber}?`, `We hope you're enjoying your order ${c.orderNumber}. A quick review helps other shoppers: ${c.link}`],
};

@Injectable()
export class OrderMessenger {
  private readonly log = new Logger("OrderMessenger");
  constructor(private readonly db: PrismaService, private readonly notify: Notifier) {}

  /** One-line alert to the shop owner with a link to the order in admin. Never throws. */
  async alertAdmin(orderId: string, subject: string, extra = ""): Promise<void> {
    try {
      const o = await this.db.order.findUnique({ where: { id: orderId }, include: { items: true, payments: { take: 1, orderBy: { createdAt: "desc" } } } });
      if (!o) return;
      const a = o.shippingAddress as { name?: string; city?: string; state?: string };
      const lines = o.items.map((i) => `  ${i.qty} x ${i.title} (${i.variantTitle})${i.engraving ? ` engraved "${i.engraving}"` : ""}`).join("\n");
      const link = env.ADMIN_URL ? `\n\nOpen in admin: ${env.ADMIN_URL}/orders/${o.id}` : "";
      await this.notify.admin(`${subject}: ${o.orderNumber}`, `${subject}\n\nOrder ${o.orderNumber}, ${rs(o.totalPaise)} (${o.payments[0]?.method === "COD" ? "cash on delivery" : "paid online"})\nCustomer: ${a.name ?? ""}, ${o.phone}${o.email ? `, ${o.email}` : ""}\nShip to: ${a.city ?? ""}, ${a.state ?? ""}\n\n${lines}${extra ? `\n\n${extra}` : ""}${link}`);
    } catch (e) { this.log.error(`admin alert ${subject} ${orderId}: ${e}`); }
  }

  /** Sends on every configured channel and records the outcome. Never throws: a failed email must not fail the order action. */
  async send(orderId: string, template: Template, extra: Partial<Ctx> = {}): Promise<void> {
    try {
      const o = await this.db.order.findUnique({ where: { id: orderId }, include: { shipments: { orderBy: { shippedAt: "desc" }, take: 1 }, payments: { take: 1, orderBy: { createdAt: "desc" } } } });
      if (!o) return;
      const sh = o.shipments[0];
      const [subject, text] = COPY[template]({ orderNumber: o.orderNumber, link: `${env.SITE_URL}/order/${o.publicId}`, total: rs(o.totalPaise), courier: sh?.courier, awb: sh?.awb, trackingUrl: sh?.trackingUrl, cod: o.paymentMethod === "COD" || o.payments[0]?.method === "COD", ...extra });
      const rows: { channel: string; toAddress: string; ok: boolean }[] = [];
      if (o.email) rows.push({ channel: "EMAIL", toAddress: o.email, ok: await this.notify.email(o.email, subject, text) });
      const wa = await this.notify.whatsapp(o.phone, text);
      if (wa || process.env.WHATSAPP_TOKEN) rows.push({ channel: "WHATSAPP", toAddress: o.phone, ok: wa });
      if (rows.length) await this.db.orderMessage.createMany({ data: rows.map((r) => ({ orderId, template, ...r })) });
    } catch (e) { this.log.error(`${template} for ${orderId}: ${e}`); }
  }
}
