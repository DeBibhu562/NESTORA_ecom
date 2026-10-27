import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "../src/index";
import { seedCatalog } from "./catalog";
import { ROLES } from "./permissions";

const hash = (pw: string) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`;
};

async function main() {
  for (const [name, perms] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: perms.map((permission) => ({ roleId: role.id, permission })) });
  }

  const owner = await prisma.role.findUniqueOrThrow({ where: { name: "Owner" } });
  const email = process.env.SEED_OWNER_EMAIL ?? "owner@example.com";
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe!12345";
  await prisma.staffUser.upsert({
    where: { email },
    update: {},
    create: { email, name: "Store Owner", passwordHash: hash(password), roleId: owner.id },
  });

  // Category tree: bottles first; others are inactive placeholders for later phases
  const bottles = await prisma.category.upsert({
    where: { slug: "bottles" }, update: {},
    create: { slug: "bottles", path: "bottles", name: "Bottles & Flasks", position: 1 },
  });
  const subs: [string, string][] = [["vacuum", "Vacuum Thermosteel"], ["single-wall", "Single-Wall Steel"], ["copper", "Copper Bottles"],
    ["glass", "Glass Bottles"], ["sports", "Sports Sippers"], ["kids", "Kids Flasks"]];
  for (const [i, [slug, name]] of subs.entries() as IterableIterator<[number, [string, string]]>) {
    await prisma.category.upsert({
      where: { slug }, update: {},
      create: { slug, path: `bottles/${slug}`, name, parentId: bottles.id, position: i },
    });
  }
  const future: [string, string][] = [["tiffins", "Lunchboxes & Tiffins"], ["casseroles", "Casseroles"], ["cookware", "Cookware"], ["storage", "Storage"]];
  for (const [i, [slug, name]] of future.entries()) {
    await prisma.category.upsert({
      where: { slug }, update: {},
      create: { slug, path: slug, name, position: i + 2, isActive: false },
    });
  }

  const attrs = [
    { key: "material", label: "Material", type: "ENUM", enumValues: ["SS 304", "Single-wall steel", "Copper", "Glass", "BPA-free plastic"], isFilterable: true, isRequired: true },
    { key: "thermal_retention", label: "Thermal Performance", type: "ENUM", enumValues: ["24h hot & cold", "12h hot", "Normal"], isFilterable: true },
    { key: "usage", label: "Usage", type: "ENUM", enumValues: ["Gym & sports", "Office", "School & kids", "Travel"], isFilterable: true },
    { key: "leak_proof", label: "Leak proof", type: "BOOLEAN" },
    { key: "country_of_origin", label: "Country of origin", type: "TEXT", isRequired: true },
    { key: "manufacturer", label: "Manufacturer", type: "TEXT", isRequired: true },
  ] as const;
  for (const [position, a] of attrs.entries()) {
    await prisma.attributeDefinition.upsert({
      where: { categoryId_key: { categoryId: bottles.id, key: a.key } }, update: {},
      create: { ...a, enumValues: [...(("enumValues" in a && a.enumValues) || [])], categoryId: bottles.id, position },
    });
  }

  await prisma.warehouse.upsert({
    where: { code: "MAIN" }, update: {},
    create: { code: "MAIN", name: "Main warehouse", pincode: "110001", state: "DL" },
  });

  if ((await prisma.cartMilestone.count()) === 0) {
    await prisma.cartMilestone.createMany({ data: [
      { thresholdPaise: 69900, rewardType: "FREE_SHIPPING", label: "Free shipping", position: 1 },
      { thresholdPaise: 149900, rewardType: "COIN_DRAW", label: "Gold/silver coin lucky draw", position: 2 },
      { thresholdPaise: 199900, rewardType: "DISCOUNT", valuePaise: 30000, label: "₹300 free gift", position: 3 },
      { thresholdPaise: 299900, rewardType: "DISCOUNT", valuePaise: 50000, label: "₹500 free gift", position: 4 },
    ] });
  }

  await prisma.coupon.upsert({
    where: { code: "DIWALI15" }, update: {},
    create: { code: "DIWALI15", type: "PERCENT", valueBp: 1500, maxDiscountPaise: 20000, startsAt: new Date("2026-01-01") },
  });
  await prisma.coupon.upsert({
    where: { code: "UPI3" }, update: {},
    create: { code: "UPI3", type: "PERCENT", valueBp: 300, paymentMethods: ["UPI"], autoApply: true, startsAt: new Date("2026-01-01") },
  });
  await seedCatalog();
  console.log("seed ok");
}

main().finally(() => prisma.$disconnect());
