"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Product, ProductVariant } from "../data/catalog";

export interface CartItem {
  id: string; // unique item id: variantId + (personalization ? "-custom" : "")
  product: Product;
  variant: ProductVariant;
  quantity: number;
  personalizationText?: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  mrpTotal: number;
  savings: number;
  finalTotal: number;
  isDrawerOpen: boolean;
  appliedCoupon: string | null;
  couponDiscount: number;
  freeShippingThreshold: number;
  freeShippingProgress: number; // 0 - 100
  amountNeededForFreeShipping: number;
  currentMilestone: {
    label: string;
    target: number;
    unlocked: boolean;
    reward: string;
  };
  openDrawer: () => void;
  closeDrawer: () => void;
  addToCart: (product: Product, variant: ProductVariant, quantity?: number, personalizationText?: string) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const FREE_SHIPPING_THRESHOLD = 699;
const MILESTONES = [
  { target: 699, label: "Free Shipping", reward: "Free Delivery unlocked" },
  { target: 1499, label: "Silver Coin", reward: "Eligible for Lucky Draw" },
  { target: 1999, label: "₹300 Free Gift", reward: "Free Travel Pouch" },
  { target: 2999, label: "₹500 VIP Gift", reward: "Free Stainless Steel Mug" },
];

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>("DIWALI15");

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nestora_cart") || localStorage.getItem("milton_cart");
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem("nestora_cart", JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + (item.variant.price + (item.personalizationText ? 99 : 0)) * item.quantity,
    0
  );

  const mrpTotal = items.reduce(
    (sum, item) => sum + (item.variant.mrp + (item.personalizationText ? 99 : 0)) * item.quantity,
    0
  );

  // 15% coupon calculation if applied
  const couponDiscount = appliedCoupon === "DIWALI15" ? Math.round(subtotal * 0.15) : 0;
  const finalTotal = Math.max(0, subtotal - couponDiscount);
  const savings = mrpTotal - finalTotal;

  const freeShippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const amountNeededForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  // Active milestone
  const nextMilestone =
    MILESTONES.find((m) => subtotal < m.target) || MILESTONES[MILESTONES.length - 1]!;
  const currentMilestone = {
    label: nextMilestone.label,
    target: nextMilestone.target,
    unlocked: subtotal >= nextMilestone.target,
    reward: nextMilestone.reward,
  };

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  const addToCart = (
    product: Product,
    variant: ProductVariant,
    quantity: number = 1,
    personalizationText?: string
  ) => {
    const itemId = `${variant.id}${personalizationText ? `-${personalizationText}` : ""}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          id: itemId,
          product,
          variant,
          quantity,
          personalizationText: personalizationText ? personalizationText.trim() : undefined,
        },
      ];
    });
    setIsDrawerOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
    );
  };

  const applyCoupon = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === "DIWALI15" || clean === "NESTORA15" || clean === "MILTON15" || clean === "WELCOME10") {
      setAppliedCoupon(clean);
      return { success: true, message: `Coupon ${clean} applied! You saved 15%` };
    }
    return { success: false, message: "Invalid coupon code. Try 'DIWALI15' or 'NESTORA15'" };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const clearCart = () => {
    setItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        mrpTotal,
        savings,
        finalTotal,
        isDrawerOpen,
        appliedCoupon,
        couponDiscount,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        freeShippingProgress,
        amountNeededForFreeShipping,
        currentMilestone,
        openDrawer,
        closeDrawer,
        addToCart,
        removeFromCart,
        updateQuantity,
        applyCoupon,
        removeCoupon,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
