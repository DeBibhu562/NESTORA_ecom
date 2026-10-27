"use client";

import React from "react";
import { Home, Grid, MessageCircle, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";

interface MobileBottomNavProps {
  onSelectCategory: (catId: string) => void;
}

export function MobileBottomNav({ onSelectCategory }: MobileBottomNavProps) {
  const { itemCount, openDrawer } = useCart();

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-line py-2 px-4 shadow-lg flex items-center justify-around">
      <button
        onClick={() => {
          onSelectCategory("all");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="flex flex-col items-center gap-1 text-navy hover:text-brand cursor-pointer"
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Home</span>
      </button>

      <button
        onClick={() => {
          onSelectCategory("bottles");
          const el = document.getElementById("catalog-section");
          el?.scrollIntoView({ behavior: "smooth" });
        }}
        className="flex flex-col items-center gap-1 text-navy hover:text-brand cursor-pointer"
      >
        <Grid className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Bottles</span>
      </button>

      <a
        href="https://wa.me/919999999999"
        target="_blank"
        rel="noreferrer"
        className="flex flex-col items-center gap-1 text-emerald-700 hover:text-emerald-800"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-[10px] font-semibold">WhatsApp</span>
      </a>

      <button
        onClick={openDrawer}
        className="relative flex flex-col items-center gap-1 text-navy hover:text-brand cursor-pointer"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5" />
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-brand text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold">Cart</span>
      </button>
    </div>
  );
}
