import { Injectable } from "@nestjs/common";
import { DEFAULT_RETURN_RULES, type ReturnRules } from "../orders/lifecycle";
import { PrismaService } from "../prisma.service";

export const DEFAULT_SHIPPING_PAISE = 9900;
export const DEFAULT_FREE_SHIPPING_PAISE = 69900;

/** Store-wide shipping rules. The free-shipping threshold lives on the FREE_SHIPPING cart milestone so the cart's progress bar and the shipping charge can never disagree. */
@Injectable()
export class SettingsService {
  constructor(private readonly db: PrismaService) {}

  async shipping() {
    const [row, ms] = await Promise.all([
      this.db.setting.findUnique({ where: { key: "shipping" } }),
      this.db.cartMilestone.findFirst({ where: { rewardType: "FREE_SHIPPING", isActive: true }, orderBy: { position: "asc" } }),
    ]);
    const flat = (row?.value as { flatPaise?: number } | null)?.flatPaise;
    return { flatPaise: flat ?? DEFAULT_SHIPPING_PAISE, freeAbovePaise: ms?.thresholdPaise ?? DEFAULT_FREE_SHIPPING_PAISE };
  }

  async saveShipping(b: { flatPaise: number; freeAbovePaise: number }) {
    await this.db.$transaction(async (tx) => {
      await tx.setting.upsert({ where: { key: "shipping" }, update: { value: { flatPaise: b.flatPaise } }, create: { key: "shipping", value: { flatPaise: b.flatPaise } } });
      const ms = await tx.cartMilestone.findFirst({ where: { rewardType: "FREE_SHIPPING" }, orderBy: { position: "asc" } });
      if (ms) await tx.cartMilestone.update({ where: { id: ms.id }, data: { thresholdPaise: b.freeAbovePaise, isActive: true } });
      else await tx.cartMilestone.create({ data: { rewardType: "FREE_SHIPPING", label: "Free shipping", thresholdPaise: b.freeAbovePaise, position: 1 } });
    });
    return this.shipping();
  }

  async returnRules(): Promise<ReturnRules> {
    const row = await this.db.setting.findUnique({ where: { key: "returns" } });
    return { ...DEFAULT_RETURN_RULES, ...((row?.value as Partial<ReturnRules> | null) ?? {}) };
  }

  async saveReturnRules(b: ReturnRules) {
    await this.db.setting.upsert({ where: { key: "returns" }, update: { value: b }, create: { key: "returns", value: b } });
    return this.returnRules();
  }

  async business() {
    const row = await this.db.setting.findUnique({ where: { key: "business" } });
    return { legalName: "", gstin: "", address: "", state: "", phone: "", email: "", ...((row?.value as object | null) ?? {}) } as { legalName: string; gstin: string; address: string; state: string; phone: string; email: string };
  }

  async saveBusiness(b: { legalName: string; gstin: string; address: string; state: string; phone: string; email: string }) {
    await this.db.setting.upsert({ where: { key: "business" }, update: { value: b }, create: { key: "business", value: b } });
    return this.business();
  }
}
