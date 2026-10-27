"use client";

import React, { useState } from "react";
import {
  X,
  Trash2,
  Gift,
  Truck,
  CheckCircle2,
  Tag,
  ArrowRight,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import type { Product, ProductVariant } from "../data/catalog";

// Mock mini upsell products for in-cart recommendations
const UPSELL_ACCESSORIES = [
  {
    id: "upsell-brush",
    title: "Silicone Bottle Cleaning Brush",
    price: 149,
    mrp: 249,
    discountPercent: 40,
    imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg",
  },
  {
    id: "upsell-gasket",
    title: "Leakproof Silicone Gasket Ring (Pack of 2)",
    price: 99,
    mrp: 199,
    discountPercent: 50,
    imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Del.jpg",
  },
];

export function CartDrawer() {
  const {
    items,
    itemCount,
    subtotal,
    mrpTotal,
    savings,
    finalTotal,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeFromCart,
    appliedCoupon,
    couponDiscount,
    applyCoupon,
    removeCoupon,
    freeShippingProgress,
    amountNeededForFreeShipping,
    addToCart,
  } = useCart();

  const [couponInput, setCouponInput] = useState("");
  const [couponFeedback, setCouponFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  if (!isDrawerOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const res = applyCoupon(couponInput);
    setCouponFeedback(res);
  };

  const addUpsell = (upsell: typeof UPSELL_ACCESSORIES[0]) => {
    const mockProd: Product = {
      id: upsell.id,
      slug: upsell.id,
      title: upsell.title,
      tagline: "Essential Bottle Care Accessory",
      category: "bottles",
      categoryName: "Accessories",
      material: "Food Grade Silicone",
      usage: "Care",
      warrantyMonths: 3,
      badges: [],
      rating: 4.9,
      reviewCount: 42,
      personalizationAvailable: false,
      featuredImage: upsell.imageUrl,
      galleryImages: [upsell.imageUrl],
      options: [],
      variants: [],
      descriptionHtml: "",
      specifications: {
        innerMaterial: "",
        outerMaterial: "",
        insulation: "",
        leakProof: false,
        dimensions: "",
        countryOfOrigin: "India",
        careInstructions: "",
      },
    };
    const mockVar: ProductVariant = {
      id: `var-${upsell.id}`,
      sku: `ACC-${upsell.id}`,
      title: "Standard",
      price: upsell.price,
      mrp: upsell.mrp,
      discountPercent: upsell.discountPercent,
      options: {},
      inventory: 50,
      imageUrl: upsell.imageUrl,
      weightGrams: 50,
    };
    addToCart(mockProd, mockVar, 1);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-line animate-slide-left">
          {/* 1. Header */}
          <div className="p-4 border-b border-line flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-navy font-heading">
                Shopping Cart
              </h2>
              <span className="bg-soft text-navy text-xs font-bold px-2 py-0.5 rounded-full border border-line">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            <button
              onClick={closeDrawer}
              className="w-8 h-8 rounded-full bg-soft hover:bg-soft-hover text-navy flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Close cart"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Tiered Free Shipping & Gift Progress Bar */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-3.5 border-b border-emerald-100">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 mb-2">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-700" />
                <span>
                  {amountNeededForFreeShipping === 0
                    ? "🎉 Free Delivery Unlocked!"
                    : `Add ₹${amountNeededForFreeShipping} more for Free Delivery!`}
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">
                ₹{subtotal} / ₹699
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-2 rounded-full bg-emerald-200/60 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>

            {/* Milestones markers */}
            <div className="flex justify-between text-[10px] text-emerald-800 font-medium mt-2 pt-1 border-t border-emerald-200/50">
              <span className={subtotal >= 699 ? "font-bold text-emerald-900" : ""}>
                ₹699 Free Shipping
              </span>
              <span className={subtotal >= 1499 ? "font-bold text-emerald-900" : ""}>
                ₹1,499 Lucky Draw
              </span>
              <span className={subtotal >= 1999 ? "font-bold text-emerald-900" : ""}>
                ₹1,999 Free Gift
              </span>
            </div>
          </div>

          {/* 3. Items Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {items.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-soft flex items-center justify-center text-3xl mx-auto">
                  🛒
                </div>
                <div className="text-sm font-bold text-navy">Your cart is empty</div>
                <p className="text-xs text-muted max-w-xs mx-auto">
                  Explore our Thermosteel water bottles and keep your drinks fresh all day.
                </p>
                <button
                  onClick={closeDrawer}
                  className="mt-2 bg-navy text-white text-xs font-semibold px-6 py-2.5 rounded-full hover:bg-navy/90 transition-colors cursor-pointer"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 rounded-2xl border border-line bg-soft/40 hover:bg-soft transition-colors"
                >
                  {/* Image */}
                  <img
                    src={item.variant.imageUrl || item.product.featuredImage}
                    alt={item.product.title}
                    className="w-16 h-16 object-contain rounded-xl bg-white p-1 border border-line/60 shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <h4 className="text-xs font-semibold text-navy leading-snug truncate">
                        {item.product.title}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted hover:text-brand cursor-pointer p-0.5"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Variant Pills inside cart */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(item.variant.options).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[10px] bg-white border border-line px-1.5 py-0.2 rounded-md font-medium text-navy"
                        >
                          {v}
                        </span>
                      ))}
                      {item.personalizationText && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-md font-medium">
                          Engraved: &quot;{item.personalizationText}&quot; (+₹99)
                        </span>
                      )}
                    </div>

                    {/* Price & Stepper Row */}
                    <div className="flex items-center justify-between mt-2 pt-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-brand">
                          ₹{(item.variant.price + (item.personalizationText ? 99 : 0)) * item.quantity}
                        </span>
                        <span className="text-[10px] text-muted line-through">
                          ₹{item.variant.mrp * item.quantity}
                        </span>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center border border-line rounded-full bg-white px-1.5 py-0.5 shadow-2xs">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-5 h-5 rounded-full hover:bg-soft text-navy text-xs font-bold flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-navy">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-5 h-5 rounded-full hover:bg-soft text-navy text-xs font-bold flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* In-Cart Cross-Sell Accessories */}
            {items.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-brand" />
                  <span>Frequently Bought Together</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {UPSELL_ACCESSORIES.map((upsell) => (
                    <div
                      key={upsell.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-white hover:border-navy/30 transition-all"
                    >
                      <img
                        src={upsell.imageUrl}
                        alt={upsell.title}
                        className="w-10 h-10 object-contain rounded-lg bg-soft p-1 shrink-0"
                      />
                      <div className="flex-1 px-2.5 min-w-0">
                        <div className="text-xs font-semibold text-navy truncate">
                          {upsell.title}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-brand">₹{upsell.price}</span>
                          <span className="text-[10px] text-muted line-through">₹{upsell.mrp}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addUpsell(upsell)}
                        className="bg-navy hover:bg-navy/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Footer & Sticky Checkout Bar */}
          {items.length > 0 && (
            <div className="p-4 border-t border-line bg-white space-y-3 sticky bottom-0">
              {/* Coupon Row */}
              <div className="space-y-1.5">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Coupon <strong>{appliedCoupon}</strong> Applied (-₹{couponDiscount})
                      </span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Discount code (try DIWALI15)"
                      className="flex-1 bg-soft rounded-xl px-3 py-2 text-xs text-navy border border-line focus:outline-hidden focus:border-navy uppercase"
                    />
                    <button
                      type="submit"
                      className="bg-navy hover:bg-navy/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {couponFeedback && !appliedCoupon && (
                  <p className="text-[11px] text-red-600">{couponFeedback.message}</p>
                )}
              </div>

              {/* Order Savings Strip */}
              {savings > 0 && (
                <div className="bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold p-2 rounded-xl text-center">
                  ✨ You are saving ₹{savings} on this order!
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Coupon Discount</span>
                    <span>-₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>Delivery</span>
                  <span>{subtotal >= 699 ? "FREE" : "₹49"}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-navy pt-1.5 border-t border-line">
                  <span>Estimated Total</span>
                  <span className="text-base text-brand">
                    ₹{finalTotal + (subtotal >= 699 ? 0 : 49)}
                  </span>
                </div>
              </div>

              {/* Primary Checkout CTA (Gokwik-style 1-click experience) */}
              <button
                onClick={() => setCheckoutModalOpen(true)}
                className="w-full bg-navy hover:bg-navy/90 text-white py-3.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Trust Badges below button */}
              <div className="flex items-center justify-center gap-3 text-[11px] text-muted pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  100% Safe Payments
                </span>
                <span>•</span>
                <span>UPI • GPay • Cards • COD</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulated 1-Click Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-line space-y-4">
            <div className="flex justify-between items-center border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-navy">Instant Checkout</h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="text-muted hover:text-navy cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-soft p-3 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-navy">Order Summary ({itemCount} items)</div>
              <div className="flex justify-between text-muted">
                <span>Payable Amount:</span>
                <span className="font-bold text-brand">₹{finalTotal + (subtotal >= 699 ? 0 : 49)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-navy block">Enter Mobile Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                className="w-full bg-soft rounded-xl px-3 py-2.5 text-xs text-navy border border-line focus:outline-hidden focus:border-navy"
                defaultValue="9876543210"
              />
              <span className="text-[10px] text-muted">
                We will send an instant OTP to auto-fill your saved address across India.
              </span>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-navy block">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  className="p-3 rounded-xl border-2 border-navy bg-navy/5 font-bold text-navy text-left flex items-center justify-between"
                >
                  <span>UPI / GPay / PhonePe</span>
                  <span className="text-[10px] bg-brand text-white px-1.5 py-0.2 rounded-xs">Extra 3% off</span>
                </button>
                <button
                  type="button"
                  className="p-3 rounded-xl border border-line hover:border-navy/40 font-semibold text-navy text-left"
                >
                  Cash On Delivery (COD)
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                alert("🎉 Order placed successfully! Your order ID is MLT-" + Math.floor(100000 + Math.random() * 900000));
                setCheckoutModalOpen(false);
                closeDrawer();
              }}
              className="w-full bg-brand hover:bg-brand-hover text-white py-3.5 rounded-full text-xs font-bold shadow-md cursor-pointer transition-colors"
            >
              Confirm Order & Pay ₹{finalTotal + (subtotal >= 699 ? 0 : 49)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
