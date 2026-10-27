import { HttpException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { sha256 } from "../auth/crypto";
import { PrismaService } from "../prisma.service";
import { priceCart, type PriceCoupon } from "../pricing/pricing";

export const MAX_QTY_PER_LINE = 10;
export const ENGRAVING_MAX = 15;
const CART_TTL_MS = 30 * 24 * 3600 * 1000;
// shortcut: flat shipping + default threshold live here, move to Setting rows when admin needs to edit them.
const SHIPPING_FLAT_PAISE = 9900;
const DEFAULT_FREE_SHIPPING_PAISE = 69900;

const fail = (status: number, title: string) => new HttpException({ title }, status);

@Injectable()
export class CartService {
  constructor(private readonly db: PrismaService) {}

  /** Returns the cart for a cookie token, or null when absent/expired. */
  private find(token?: string) {
    if (!token) return Promise.resolve(null);
    return this.db.cart.findFirst({ where: { anonToken: sha256(token), expiresAt: { gt: new Date() } }, select: { id: true } });
  }

  /** Finds or creates the cart; `token` is non-null only when a new cookie must be set. */
  async ensure(token?: string) {
    const c = await this.find(token);
    if (c) return { id: c.id, token: null };
    const fresh = randomBytes(32).toString("hex");
    const cart = await this.db.cart.create({ data: { anonToken: sha256(fresh), expiresAt: new Date(Date.now() + CART_TTL_MS) }, select: { id: true } });
    return { id: cart.id, token: fresh };
  }

  async add(token: string | undefined, b: { variantId: string; qty: number; engraving: string; isGift: boolean }) {
    const v = await this.db.variant.findFirst({
      where: { id: b.variantId, isActive: true, product: { status: "ACTIVE", deletedAt: null } },
      select: { id: true, product: { select: { personalizationEnabled: true } } },
    });
    if (!v) throw fail(404, "This item is no longer available");
    if (b.engraving && !v.product.personalizationEnabled) throw fail(400, "Engraving isn't available for this product");
    const cart = await this.ensure(token);
    const key = { cartId: cart.id, variantId: v.id, engraving: b.engraving, isGift: b.isGift };
    const existing = await this.db.cartItem.findUnique({ where: { cartId_variantId_engraving_isGift: key }, select: { qty: true } });
    const qty = Math.min((existing?.qty ?? 0) + b.qty, MAX_QTY_PER_LINE);
    await this.assertStock(v.id, qty);
    await this.db.cartItem.upsert({ where: { cartId_variantId_engraving_isGift: key }, update: { qty }, create: { ...key, qty } });
    return cart;
  }

  async setQty(token: string | undefined, itemId: string, qty: number) {
    const cart = await this.find(token);
    if (!cart) throw fail(404, "Cart not found");
    const item = await this.db.cartItem.findFirst({ where: { id: itemId, cartId: cart.id }, select: { variantId: true } });
    if (!item) throw fail(404, "Item not in cart");
    if (qty === 0) await this.db.cartItem.delete({ where: { id: itemId } });
    else {
      await this.assertStock(item.variantId, qty);
      await this.db.cartItem.update({ where: { id: itemId }, data: { qty } });
    }
    return cart;
  }

  async setCoupon(token: string | undefined, code: string | null) {
    const cart = await this.find(token);
    if (!cart) throw fail(404, "Cart not found");
    if (code && !(await this.activeCoupon(code))) throw fail(400, "This coupon isn't valid");
    await this.db.cart.update({ where: { id: cart.id }, data: { couponCode: code } });
    return cart;
  }

  private async assertStock(variantId: string, qty: number) {
    const a = await this.available(variantId);
    if (qty > a) throw fail(409, a > 0 ? `Only ${a} left in stock` : "Out of stock");
  }

  private async available(variantId: string) {
    const rows = await this.db.inventoryLevel.findMany({ where: { variantId, warehouse: { isActive: true } }, select: { onHand: true, reserved: true } });
    return rows.reduce((a, r) => a + Math.max(0, r.onHand - r.reserved), 0);
  }

  private activeCoupon(code: string) {
    const now = new Date();
    return this.db.coupon.findFirst({
      where: { code, isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      // payment-method coupons (e.g. UPI3) are applied at checkout, not entered in the cart; Prisma's isEmpty filter doesn't match here
    }).then((c) => (c && !c.paymentMethods.length && (c.usageLimit == null || c.usedCount < c.usageLimit) ? c : null));
  }

  /** The re-priced cart the client renders. Never trusts anything the client sent about prices. */
  async view(cartId: string | null) {
    const cart = cartId
      ? await this.db.cart.findUnique({
          where: { id: cartId },
          include: { items: { orderBy: { id: "asc" }, include: { variant: { include: { product: { include: { media: { orderBy: { position: "asc" }, take: 1 } } }, inventory: true } } } } },
        })
      : null;
    const milestones = await this.db.cartMilestone.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
    const freeShippingAbove = milestones.find((m) => m.rewardType === "FREE_SHIPPING")?.thresholdPaise ?? DEFAULT_FREE_SHIPPING_PAISE;
    const items = (cart?.items ?? []).filter((i) => i.variant.isActive && i.variant.product.status === "ACTIVE" && !i.variant.product.deletedAt);

    const lines = items.map((i) => {
      const p = i.variant.product;
      const extra = i.engraving ? p.personalizationPricePaise ?? 0 : 0;
      const avail = i.variant.inventory.reduce((a, r) => a + Math.max(0, r.onHand - r.reserved), 0);
      return { i, p, avail, unit: i.variant.pricePaise + extra };
    });

    const coupon = cart?.couponCode ? await this.activeCoupon(cart.couponCode) : null;
    const scope = (coupon?.appliesTo ?? null) as { categoryIds?: string[]; productIds?: string[] } | null;
    const inScope = (p: { id: string; categoryId: string }) =>
      !scope || ((!scope.categoryIds?.length || scope.categoryIds.includes(p.categoryId)) && (!scope.productIds?.length || scope.productIds.includes(p.id)));

    // shortcut: no pincode→state lookup yet, so GST is always reported as intra-state (CGST+SGST); real split happens at checkout.
    const priced = priceCart({
      lines: lines.map((l) => ({ id: l.i.id, unitPaise: l.unit, qty: l.i.qty, gstRateBp: l.p.gstRateBp, couponEligible: inScope(l.p) })),
      coupon: coupon ? ({ type: coupon.type, valueBp: coupon.valueBp ?? undefined, valuePaise: coupon.valuePaise ?? undefined, maxDiscountPaise: coupon.maxDiscountPaise ?? undefined, minSubtotalPaise: coupon.minSubtotalPaise } satisfies PriceCoupon) : undefined,
      freeShippingAbovePaise: freeShippingAbove, shippingPaise: SHIPPING_FLAT_PAISE, intraState: true,
    });

    const base = priced.subtotal - priced.couponDiscount;
    const next = milestones.find((m) => m.thresholdPaise > base) ?? null;
    return {
      items: lines.map((l, k) => ({
        id: l.i.id, variantId: l.i.variantId, sku: l.i.variant.sku, title: l.p.title, slug: l.p.slug, image: l.p.media[0] ? { url: l.p.media[0].url, alt: l.p.media[0].alt } : null,
        qty: l.i.qty, engraving: l.i.engraving, isGift: l.i.isGift, unitPaise: l.unit, mrpPaise: l.i.variant.mrpPaise,
        linePaise: priced.lines[k]!.net, inStock: l.avail >= l.i.qty, available: l.avail,
      })),
      coupon: cart?.couponCode ? { code: cart.couponCode, applied: priced.couponApplied } : null,
      subtotalPaise: priced.subtotal, couponDiscountPaise: priced.couponDiscount, shippingPaise: priced.shipping, taxPaise: priced.tax, totalPaise: priced.total,
      milestones: {
        reached: milestones.filter((m) => m.thresholdPaise <= base).map((m) => ({ id: m.id, label: m.label, type: m.rewardType })),
        next: next ? { id: next.id, label: next.label, thresholdPaise: next.thresholdPaise, remainingPaise: next.thresholdPaise - base } : null,
      },
    };
  }

  async viewByToken(token?: string) {
    return this.view((await this.find(token))?.id ?? null);
  }
}
