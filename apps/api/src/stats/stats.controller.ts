import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { Perm } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";

const q = z.object({ range: z.enum(["7d", "30d", "90d"]).default("30d") });
// Orders that count as sales: money received or promised (COD), not abandoned/cancelled/returned.
const SALE = ["PLACED", "CONFIRMED", "PROCESSING", "PARTIALLY_SHIPPED", "SHIPPED", "DELIVERED", "CLOSED"] as const;
const DAY = 86_400_000;

@Controller("admin/stats")
export class StatsController {
  constructor(private readonly db: PrismaService) {}

  @Get("overview") @Perm("order:read")
  async overview(@Query(new ZodPipe(q)) { range }: z.infer<typeof q>) {
    const days = parseInt(range);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const from = new Date(end.getTime() - days * DAY + 1);
    const prevFrom = new Date(from.getTime() - days * DAY);
    const where = (a: Date, b: Date) => ({ createdAt: { gte: a, lte: b }, status: { in: [...SALE] } });

    const [cur, prev, byStatus, daily, topRaw, cats, recent, newCustomers] = await Promise.all([
      this.db.order.aggregate({ where: where(from, end), _sum: { totalPaise: true }, _count: true }),
      this.db.order.aggregate({ where: where(prevFrom, from), _sum: { totalPaise: true }, _count: true }),
      this.db.order.groupBy({ by: ["status"], where: { createdAt: { gte: from, lte: end } }, _count: true }),
      this.db.$queryRaw<{ d: Date; revenue: bigint; orders: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS d, COALESCE(SUM("totalPaise"),0) AS revenue, COUNT(*) AS orders
        FROM "Order" WHERE "createdAt" BETWEEN ${from} AND ${end} AND status::text = ANY(${[...SALE]}) GROUP BY 1 ORDER BY 1`,
      this.db.$queryRaw<{ title: string; qty: bigint; revenue: bigint }[]>`
        SELECT i.title, SUM(i.qty) AS qty, SUM(i."totalPaise") AS revenue FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
        WHERE o."createdAt" BETWEEN ${from} AND ${end} AND o.status::text = ANY(${[...SALE]}) GROUP BY i.title ORDER BY revenue DESC LIMIT 5`,
      this.db.$queryRaw<{ name: string; revenue: bigint }[]>`
        SELECT c.name, SUM(i."totalPaise") AS revenue FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
        JOIN "Variant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId" JOIN "Category" c ON c.id = p."categoryId"
        WHERE o."createdAt" BETWEEN ${from} AND ${end} AND o.status::text = ANY(${[...SALE]}) GROUP BY c.name ORDER BY revenue DESC`,
      this.db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, orderNumber: true, status: true, totalPaise: true, createdAt: true, shippingAddress: true } }),
      this.db.user.count({ where: { createdAt: { gte: from, lte: end } } }),
    ]);

    const revenue = cur._sum.totalPaise ?? 0, prevRevenue = prev._sum.totalPaise ?? 0;
    const byDay = new Map(daily.map((r) => [r.d.toISOString().slice(0, 10), r]));
    const series = Array.from({ length: days }, (_, i) => {
      const day = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10);
      const r = byDay.get(day);
      return { day, revenuePaise: Number(r?.revenue ?? 0), orders: Number(r?.orders ?? 0) };
    });
    return {
      range, revenuePaise: revenue, prevRevenuePaise: prevRevenue, orders: cur._count, prevOrders: prev._count,
      aovPaise: cur._count ? Math.round(revenue / cur._count) : 0, newCustomers,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })), series,
      topProducts: topRaw.map((r) => ({ title: r.title, qty: Number(r.qty), revenuePaise: Number(r.revenue) })),
      categories: cats.map((r) => ({ name: r.name, revenuePaise: Number(r.revenue) })),
      recent: recent.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, totalPaise: o.totalPaise, createdAt: o.createdAt, city: (o.shippingAddress as { city?: string } | null)?.city ?? null })),
    };
  }
}
