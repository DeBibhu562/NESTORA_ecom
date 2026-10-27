import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma.service";

const adjustDto = z.object({
  variantId: z.string(), warehouseId: z.string(), reason: z.enum(["PURCHASE", "ADJUST", "DAMAGE", "RETURN"]),
  delta: z.number().int().refine((n) => n !== 0, "Delta cannot be 0").optional(), setOnHand: z.number().int().min(0).optional(),
}).refine((d) => (d.delta === undefined) !== (d.setOnHand === undefined), { message: "Provide exactly one of delta or setOnHand" });

@Controller("admin/inventory")
export class InventoryController {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  @Get("warehouses") @Perm("warehouse:read") warehouses() { return this.db.warehouse.findMany({ where: { isActive: true } }); }

  @Get("low-stock") @Perm("inventory:read")
  lowStock(@Query("limit") limit = "50") {
    return this.db.$queryRaw`
      SELECT v."id" "variantId", v."sku", p."title", i."onHand", i."reserved", i."lowStockAt"
      FROM "InventoryLevel" i JOIN "Variant" v ON v.id = i."variantId" JOIN "Product" p ON p.id = v."productId"
      WHERE i."onHand" - i."reserved" <= i."lowStockAt" AND v."isActive" AND p."deletedAt" IS NULL
      ORDER BY i."onHand" - i."reserved" LIMIT ${Math.min(Number(limit) || 50, 200)}`;
  }

  /** Stock changes always write a ledger row in the same transaction; the level row is version-bumped. */
  @Post("adjust") @Perm("inventory:write")
  async adjust(@Body(new ZodPipe(adjustDto)) b: z.infer<typeof adjustDto>, @Staff() s: StaffClaims) {
    const [v, w] = await Promise.all([this.db.variant.findUnique({ where: { id: b.variantId } }), this.db.warehouse.findUnique({ where: { id: b.warehouseId } })]);
    if (!v || !w) throw new NotFoundException("Variant or warehouse not found");
    const level = await this.db.$transaction(async (tx) => {
      await tx.inventoryLevel.upsert({ where: { variantId_warehouseId: { variantId: b.variantId, warehouseId: b.warehouseId } }, update: {}, create: { variantId: b.variantId, warehouseId: b.warehouseId } });
      // row lock so concurrent adjustments serialise
      const [cur] = await tx.$queryRaw<{ onHand: number; reserved: number }[]>`SELECT "onHand","reserved" FROM "InventoryLevel" WHERE "variantId"=${b.variantId} AND "warehouseId"=${b.warehouseId} FOR UPDATE`;
      const next = b.setOnHand ?? cur!.onHand + b.delta!;
      if (next < cur!.reserved) throw new ConflictException(`Cannot go below reserved stock (${cur!.reserved})`);
      if (next < 0) throw new BadRequestException("Stock cannot be negative");
      await tx.stockMovement.create({ data: { variantId: b.variantId, warehouseId: b.warehouseId, delta: next - cur!.onHand, reason: b.reason, staffId: s.id } });
      return tx.inventoryLevel.update({ where: { variantId_warehouseId: { variantId: b.variantId, warehouseId: b.warehouseId } }, data: { onHand: next, version: { increment: 1 } } });
    });
    await this.audit.log(s.id, "inventory.adjust", "Variant", b.variantId, b);
    return level;
  }
}
