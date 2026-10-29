import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { hasPerm } from "../auth/auth.guard";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";

const listDto = z.object({ q: z.string().trim().max(60).optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });
const SPENT = ["PLACED", "CONFIRMED", "PROCESSING", "PARTIALLY_SHIPPED", "SHIPPED", "DELIVERED", "CLOSED"] as const;
const maskPhone = (p: string | null) => (p ? p.replace(/\d(?=\d{3})/g, "•") : null);
const maskEmail = (e: string | null) => (e ? e.replace(/^(.).*(@.*)$/, "$1•••$2") : null);

@Controller("admin/customers")
export class CustomersAdminController {
  constructor(private readonly db: PrismaService) {}

  @Get() @Perm("customer:read")
  async list(@Query(new ZodPipe(listDto)) q: z.infer<typeof listDto>, @Staff() s: StaffClaims) {
    const reveal = hasPerm(s.perms, "customer:reveal");
    const where = { deletedAt: null, ...(q.q && { OR: [{ name: { contains: q.q, mode: "insensitive" as const } }, { email: { contains: q.q, mode: "insensitive" as const } }, { phone: { contains: q.q } }] }) };
    const rows = await this.db.user.findMany({ where, take: q.limit + 1, orderBy: { createdAt: "desc" }, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, name: true, email: true, phone: true, isBlocked: true, googleUid: true, createdAt: true, orders: { where: { status: { in: [...SPENT] } }, select: { totalPaise: true, createdAt: true } } } });
    const next = rows.length > q.limit ? rows.pop()!.id : null;
    return {
      total: await this.db.user.count({ where }), nextCursor: next,
      items: rows.map(({ orders, email, phone, googleUid, ...u }) => ({
        ...u, email: reveal ? email : maskEmail(email), phone: reveal ? phone : maskPhone(phone), google: !!googleUid,
        orders: orders.length, spentPaise: orders.reduce((a, o) => a + o.totalPaise, 0), lastOrderAt: orders.map((o) => o.createdAt).sort().at(-1) ?? null,
      })),
    };
  }
}
