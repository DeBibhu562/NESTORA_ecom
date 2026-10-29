import { HttpException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { sha256 } from "../auth/crypto";
import { PrismaService } from "../prisma.service";
import { SettingsService } from "../settings/settings.service";
import { priceCart, type PriceCoupon } from "../pricing/pricing";

export const MAX_QTY_PER_LINE = 10;
export const ENGRAVING_MAX = 15;
const CART_TTL_MS = 30 * 24 * 3600 * 1000;

const fail = (status: number, title: string) => new HttpException({ title }, status);

@Injectable()
export class CartService {
  constructor(private readonly db: PrismaService, private readonly settings: SettingsService) {}

  /** Returns the cart for a cookie token, or null when absent/expired. */
  findByToken(token: string) { return this.find(token); }

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
    return (await this.build(cartId)).view;
  }

  /** `intraState` only changes the CGST/SGST vs IGST split; checkout passes the real value once the address is known. */
  async build(cartId: string | null, intraState = true) {
    const cart = cartId
      ? await this.db.cart.findUnique({
          where: { id: cartId },
          include: { items: { orderBy: { id: "asc" }, include: { variant: { include: { product: { include: { media: { orderBy: { position: "asc" }, take: 1 } } }, inventory: true, options: { include: { optionValue: true } } } } } } },
        })
      : null;
    const milestones = await this.db.cartMilestone.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
    const ship = await this.settings.shipping();
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
    const input = {
      lines: lines.map((l) => ({ id: l.i.id, unitPaise: l.unit, qty: l.i.qty, gstRateBp: l.p.gstRateBp, couponEligible: inScope(l.p) })),
      coupon: coupon ? ({ type: coupon.type, valueBp: coupon.valueBp ?? undefined, valuePaise: coupon.valuePaise ?? undefined, maxDiscountPaise: coupon.maxDiscountPaise ?? undefined, minSubtotalPaise: coupon.minSubtotalPaise } satisfies PriceCoupon) : undefined,
      freeShippingAbovePaise: ship.freeAbovePaise, shippingPaise: ship.flatPaise, intraState,
    };
    // Milestones are judged on subtotal minus coupon, so price once to learn the coupon, then again with the best DISCOUNT reward reached (rewards don't stack).
    const first = priceCart(input);
    const base = first.subtotal - first.couponDiscount;
    const rewardPaise = Math.max(0, ...milestones.filter((m) => m.rewardType === "DISCOUNT" && m.thresholdPaise <= base).map((m) => m.valuePaise ?? 0));
    const priced = rewardPaise ? priceCart({ ...input, rewardPaise }) : first;
    const upsells = await this.upsells(items.map((i) => i.variant.productId));
    const next = milestones.find((m) => m.thresholdPaise > base) ?? null;
    const view = {
      items: lines.map((l, k) => ({
        id: l.i.id, variantId: l.i.variantId, sku: l.i.variant.sku, title: l.p.title, slug: l.p.slug, image: l.p.media[0] ? { url: l.p.media[0].url, alt: l.p.media[0].alt } : null,
        qty: l.i.qty, engraving: l.i.engraving, isGift: l.i.isGift, unitPaise: l.unit, mrpPaise: l.i.variant.mrpPaise,
        linePaise: priced.lines[k]!.net, inStock: l.avail >= l.i.qty, available: l.avail,
      })),
      coupon: cart?.couponCode ? { code: cart.couponCode, applied: priced.couponApplied } : null,
      subtotalPaise: priced.subtotal, couponDiscountPaise: priced.couponDiscount, rewardDiscountPaise: priced.rewardDiscount, shippingPaise: priced.shipping, taxPaise: priced.tax, totalPaise: priced.total,
      upsells,
      milestones: {
        reached: milestones.filter((m) => m.thresholdPaise <= base).map((m) => ({ id: m.id, label: m.label, type: m.rewardType })),
        next: next ? { id: next.id, label: next.label, thresholdPaise: next.thresholdPaise, remainingPaise: next.thresholdPaise - base } : null,
      },
    };
    return { view, priced, lines, coupon: coupon && priced.couponApplied ? coupon : null };
  }

  /**
   * On sign-in: folds the browser's guest cart into the account's cart (or adopts it if the account has none), so nothing a
   * shopper added before logging in is lost. Returns a new cookie token only when the browser had no cart cookie.
   */
  async attach(userId: string, token?: string): Promise<string | null> {
    const anon = token ? await this.find(token) : null;
    const mine = await this.db.cart.findFirst({ where: { userId, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: "desc" }, select: { id: true, couponCode: true } });
    const expiresAt = new Date(Date.now() + CART_TTL_MS);
    if (anon && (!mine || mine.id === anon.id)) { await this.db.cart.update({ where: { id: anon.id }, data: { userId, expiresAt } }); return null; }
    if (!anon && mine) {
      const fresh = randomBytes(32).toString("hex");
      await this.db.cart.update({ where: { id: mine.id }, data: { anonToken: sha256(fresh), expiresAt } });
      return fresh;
    }
    if (!anon || !mine) return null;
    const items = await this.db.cartItem.findMany({ where: { cartId: anon.id } });
    const guest = await this.db.cart.findUniqueOrThrow({ where: { id: anon.id }, select: { couponCode: true } });
    await this.db.$transaction(async (tx) => {
      for (const i of items) {
        const key = { cartId: mine.id, variantId: i.variantId, engraving: i.engraving, isGift: i.isGift };
        const have = await tx.cartItem.findUnique({ where: { cartId_variantId_engraving_isGift: key }, select: { qty: true } });
        const qty = Math.min((have?.qty ?? 0) + i.qty, MAX_QTY_PER_LINE);
        await tx.cartItem.upsert({ where: { cartId_variantId_engraving_isGift: key }, update: { qty }, create: { ...key, qty } });
      }
      await tx.cart.delete({ where: { id: anon.id } }); // frees the cookie token for the surviving cart
      await tx.cart.update({ where: { id: mine.id }, data: { anonToken: sha256(token!), expiresAt, couponCode: mine.couponCode ?? guest.couponCode } });
    });
    return null;
  }

  /** A few in-stock bestsellers not already in the cart, for the drawer's "add more" strip. */
  private async upsells(inCart: string[]) {
    const rows = await this.db.product.findMany({
      where: { status: "ACTIVE", deletedAt: null, id: { notIn: inCart }, variants: { some: { isActive: true, inventory: { some: { onHand: { gt: 0 } } } } } },
      orderBy: [{ ratingCount: "desc" }, { createdAt: "desc" }], take: 3,
      select: { slug: true, title: true, media: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } }, variants: { where: { isActive: true }, select: { pricePaise: true } } },
    });
    return rows.map((p) => ({ slug: p.slug, title: p.title, image: p.media[0] ?? null, fromPaise: Math.min(...p.variants.map((v) => v.pricePaise)) }));
  }

  async viewByToken(token?: string) {
    return this.view((await this.find(token))?.id ?? null);
  }
}
