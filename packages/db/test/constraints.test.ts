import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/index";

afterAll(() => prisma.$disconnect());

describe("DB constraints (migration 2)", () => {
  it("rejects reserved > onHand", async () => {
    const { id: warehouseId } = await prisma.warehouse.findFirstOrThrow();
    const cat = await prisma.category.findFirstOrThrow();
    const p = await prisma.product.create({ data: { slug: `t-${Date.now()}`, title: "t", descriptionHtml: "", categoryId: cat.id, hsnCode: "7323", gstRateBp: 1800 } });
    const v = await prisma.variant.create({ data: { productId: p.id, sku: `T-${Date.now()}`, pricePaise: 100, mrpPaise: 120, weightGrams: 1 } });
    await expect(prisma.inventoryLevel.create({ data: { variantId: v.id, warehouseId, onHand: 1, reserved: 2 } })).rejects.toThrow();
    await prisma.product.delete({ where: { id: p.id } });
  });

  it("rejects MRP below selling price", async () => {
    const cat = await prisma.category.findFirstOrThrow();
    const p = await prisma.product.create({ data: { slug: `t2-${Date.now()}`, title: "t", descriptionHtml: "", categoryId: cat.id, hsnCode: "7323", gstRateBp: 1800 } });
    await expect(prisma.variant.create({ data: { productId: p.id, sku: `T2-${Date.now()}`, pricePaise: 200, mrpPaise: 100, weightGrams: 1 } })).rejects.toThrow();
    await prisma.product.delete({ where: { id: p.id } });
  });

  it("search trigger fills searchVector", async () => {
    const cat = await prisma.category.findFirstOrThrow();
    const p = await prisma.product.create({ data: { slug: `t3-${Date.now()}`, title: "Felice Bottle", descriptionHtml: "", categoryId: cat.id, hsnCode: "7323", gstRateBp: 1800 } });
    const r = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM "Product" WHERE id=${p.id} AND "searchVector" @@ to_tsquery('simple','felice')`;
    expect(Number(r[0]!.n)).toBe(1);
    await prisma.product.delete({ where: { id: p.id } });
  });
});
