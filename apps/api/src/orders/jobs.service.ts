import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { SettingsService } from "../settings/settings.service";
import { DAY } from "./lifecycle";
import { OrderMessenger } from "./messenger.service";

/** Background housekeeping. Every job is idempotent (it re-selects what still needs doing), so running on several servers at once is safe. */
@Injectable()
export class OrderJobs implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("OrderJobs");
  private timer?: NodeJS.Timeout;
  constructor(private readonly db: PrismaService, private readonly settings: SettingsService, private readonly messenger: OrderMessenger) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.run().catch((e) => this.log.error(e)), 15 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  async run() { return { closed: await this.closeExpired(), reviews: await this.reviewRequests() }; }

  /** Delivered orders whose return window (plus grace) has ended become CLOSED, unless a return is still open. */
  async closeExpired() {
    const r = await this.settings.returnRules();
    const cutoff = new Date(Date.now() - (r.windowDays + r.graceDays) * DAY);
    const due = await this.db.order.findMany({ where: { status: "DELIVERED", deliveredAt: { lt: cutoff }, returns: { none: { status: { in: ["REQUESTED", "APPROVED", "PICKUP_SCHEDULED", "RECEIVED"] } } } }, select: { id: true }, take: 200 });
    for (const { id } of due) {
      const hit = await this.db.order.updateMany({ where: { id, status: "DELIVERED" }, data: { status: "CLOSED" } });
      if (hit.count) await this.db.orderEvent.create({ data: { orderId: id, type: "closed", message: "Return window ended", actor: "system" } });
    }
    return due.length;
  }

  /** One review request, 3 days after delivery. The OrderMessage log is the "already sent" record. */
  async reviewRequests() {
    const from = new Date(Date.now() - 10 * DAY), to = new Date(Date.now() - 3 * DAY);
    const due = await this.db.order.findMany({ where: { status: { in: ["DELIVERED", "CLOSED"] }, deliveredAt: { gte: from, lte: to }, messages: { none: { template: "REVIEW_REQUEST" } } }, select: { id: true }, take: 100 });
    for (const { id } of due) await this.messenger.send(id, "REVIEW_REQUEST");
    return due.length;
  }
}
