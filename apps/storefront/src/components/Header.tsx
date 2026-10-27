"use client";

import React, { useState } from "react";
import { Search, ShoppingBag, Truck, Sparkles, MessageCircle, ChevronRight, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { PRODUCTS, type Product } from "../data/catalog";
import { NestoraLogo } from "./NestoraLogo";

interface HeaderProps {
  onSelectProduct: (product: Product) => void;
  onOpenTrackModal: () => void;
  activeCategory: string;
  onSelectCategory: (catId: string) => void;
}

export function Header({
  onSelectProduct,
  onOpenTrackModal,
  activeCategory,
  onSelectCategory,
}: HeaderProps) {
  const { itemCount, openDrawer } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Filter products for predictive search
  const searchResults = searchQuery.trim()
    ? PRODUCTS.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.material.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-line shadow-2xs">
      {/* 1. Announcement Ticker Bar */}
      <div className="bg-navy text-white text-[11px] py-1.5 px-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
            <span className="font-medium tracking-wide">
              Additional Flat 3% Off On UPI Payment • Free Delivery Above ₹699
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-gray-300">
            <button
              onClick={onOpenTrackModal}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <Truck className="w-3.5 h-3.5 text-brand" /> Track Order
            </button>
            <a
              href="https://wa.me/919999999999"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp Support
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Header (Logo, Search, Utilities) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => onSelectCategory("all")}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
          >
            <NestoraLogo variant="header" />
          </div>

          {/* Desktop Search Bar */}
          <div className="relative hidden sm:block flex-1 max-w-xl mx-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search Thermosteel bottles, flasks, copper, sippers..."
                className="w-full bg-soft border border-line rounded-full py-2.5 pl-10 pr-4 text-xs text-navy placeholder:text-muted focus:outline-hidden focus:border-navy transition-all"
              />
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-3" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-2.5 text-muted hover:text-navy cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Predictive Search Dropdown */}
            {isSearchFocused && searchResults.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-line overflow-hidden z-50 animate-scale-in"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="p-2 border-b border-line bg-soft text-[11px] font-semibold text-muted">
                  Matching Products ({searchResults.length})
                </div>
                <div className="divide-y divide-line/60">
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        onSelectProduct(product);
                        setIsSearchFocused(false);
                      }}
                      className="p-3 hover:bg-soft transition-colors cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={product.featuredImage}
                          alt={product.title}
                          className="w-10 h-10 object-contain rounded-lg bg-soft p-1"
                        />
                        <div>
                          <div className="text-xs font-semibold text-navy leading-tight">
                            {product.title}
                          </div>
                          <div className="text-[11px] text-muted">
                            {product.categoryName} • {product.material}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand">
                          ₹{product.variants[0]?.price}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Track Order Icon Button (Mobile) */}
            <button
              onClick={onOpenTrackModal}
              className="sm:hidden p-2 rounded-full hover:bg-soft text-navy cursor-pointer"
              title="Track Order"
            >
              <Truck className="w-5 h-5 text-brand" />
            </button>

            {/* Shopping Cart Drawer Trigger */}
            <button
              onClick={openDrawer}
              className="relative p-2.5 rounded-full bg-soft hover:bg-soft-hover border border-line text-navy transition-colors cursor-pointer flex items-center justify-center shadow-2xs"
              aria-label="View Shopping Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Row (full width below logo) */}
        <div className="sm:hidden mt-2 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search bottles, flasks, copper..."
            className="w-full bg-soft border border-line rounded-full py-2 pl-9 pr-4 text-xs text-navy placeholder:text-muted focus:outline-hidden focus:border-navy"
          />
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2 text-muted hover:text-navy cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Mobile Predictive Dropdown */}
          {isSearchFocused && searchResults.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-line overflow-hidden z-50 animate-scale-in"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="p-2 border-b border-line bg-soft text-[11px] font-semibold text-muted">
                Matching Products ({searchResults.length})
              </div>
              <div className="divide-y divide-line/60 max-h-60 overflow-y-auto">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      onSelectProduct(product);
                      setIsSearchFocused(false);
                    }}
                    className="p-3 hover:bg-soft transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={product.featuredImage}
                        alt={product.title}
                        className="w-8 h-8 object-contain rounded-lg bg-soft p-1"
                      />
                      <div>
                        <div className="text-xs font-semibold text-navy leading-tight">
                          {product.title}
                        </div>
                        <div className="text-[10px] text-muted">
                          ₹{product.variants[0]?.price}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Category Bar Navigation */}
      <nav className="border-t border-line/70 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-2 text-xs font-semibold">
          <button
            onClick={() => onSelectCategory("all")}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === "all"
                ? "bg-navy text-white shadow-xs"
                : "text-navy/80 hover:bg-soft hover:text-navy"
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => onSelectCategory("bottles")}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "bottles"
                ? "bg-navy text-white shadow-xs"
                : "text-navy/80 hover:bg-soft hover:text-navy"
            }`}
          >
            <span>Bottles & Flasks</span>
            <span className="bg-brand text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              12
            </span>
          </button>
          <button
            onClick={() => onSelectCategory("lunchboxes")}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === "lunchboxes"
                ? "bg-navy text-white shadow-xs"
                : "text-navy/80 hover:bg-soft hover:text-navy"
            }`}
          >
            Lunchboxes & Tiffins
          </button>
          <button
            onClick={() => onSelectCategory("casseroles")}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === "casseroles"
                ? "bg-navy text-white shadow-xs"
                : "text-navy/80 hover:bg-soft hover:text-navy"
            }`}
          >
            Casseroles & Hot Pots
          </button>
          <button
            onClick={() => onSelectCategory("cookware")}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === "cookware"
                ? "bg-navy text-white shadow-xs"
                : "text-navy/80 hover:bg-soft hover:text-navy"
            }`}
          >
            Cookware & Pans
          </button>
          <button
            onClick={() => alert("Corporate Gifting inquiries: email corporate@nestora.in or click Bulk Order on any product page.")}
            className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold text-muted hover:bg-soft hover:text-navy transition-all cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <span>Corporate Gifting</span>
          </button>
          <button
            onClick={() => alert("Spare parts (Caps, Straws, Lids, and Gaskets) available under product accessories.")}
            className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold text-muted hover:bg-soft hover:text-navy transition-all cursor-pointer"
          >
            Spare Parts
          </button>
        </div>
      </nav>
    </header>
  );
}
