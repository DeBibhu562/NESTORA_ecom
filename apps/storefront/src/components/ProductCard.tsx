"use client";

import React, { useState } from "react";
import { Star, ShoppingBag, Eye } from "lucide-react";
import type { Product } from "../data/catalog";
import { COLOR_HEX } from "../data/catalog";
import { useCart } from "../context/CartContext";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const { addToCart } = useCart();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Find color option if exists
  const colorOption = product.options.find(
    (o) => o.name === "Colour" || o.name === "Color" || o.name === "Finish" || o.name === "Character"
  );

  // Find active variant matching selected color, or fallback to first
  const activeVariant =
    (selectedColor &&
      product.variants.find((v) =>
        Object.values(v.options).includes(selectedColor)
      )) ||
    product.variants[0];

  const displayImage = activeVariant?.imageUrl || product.featuredImage;

  return (
    <div
      onClick={() => onSelect(product)}
      className="group relative flex flex-col justify-between rounded-2xl border border-line bg-soft/50 p-3 sm:p-4 transition-all duration-300 hover:border-navy/30 hover:shadow-md cursor-pointer"
    >
      {/* 1. Badges & Wishlist / Quick View */}
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-white p-3 flex items-center justify-center">
        {product.badges.length > 0 && (
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
            <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wide">
              {product.badges[0]}
            </span>
          </div>
        )}

        {/* Quick View Button */}
        <button
          onClick={() => onSelect(product)}
          className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-line text-navy flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-navy hover:text-white cursor-pointer shadow-sm"
          title="Quick View"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Product Image with smooth hover zoom */}
        <img
          src={displayImage}
          alt={product.title}
          onClick={() => onSelect(product)}
          className="h-full w-full object-contain cursor-pointer transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* 2. Interactive Color Swatches */}
      {colorOption && colorOption.values.length > 1 && (
        <div className="flex items-center gap-1.5 mb-2.5">
          {colorOption.values.slice(0, 5).map((col) => {
            const hex = col.hexColor || COLOR_HEX[col.value] || "#bbb";
            const isActive = selectedColor === col.value || (!selectedColor && activeVariant?.options[colorOption.name] === col.value);
            return (
              <button
                key={col.value}
                type="button"
                onMouseEnter={() => setSelectedColor(col.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedColor(col.value);
                }}
                title={col.value}
                className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                  isActive ? "ring-2 ring-navy scale-125" : "border-line hover:scale-110"
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
          {colorOption.values.length > 5 && (
            <span className="text-[10px] text-muted font-medium">
              +{colorOption.values.length - 5}
            </span>
          )}
        </div>
      )}

      {/* 3. Product Info */}
      <div className="flex-1 cursor-pointer" onClick={() => onSelect(product)}>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="flex items-center text-gold text-xs">
            <Star className="w-3.5 h-3.5 fill-gold stroke-none" />
            <span className="ml-1 text-[11px] font-semibold text-navy">
              {product.rating}
            </span>
          </div>
          <span className="text-[11px] text-muted">({product.reviewCount})</span>
        </div>

        <h3 className="text-xs sm:text-sm font-semibold text-navy leading-snug line-clamp-2 group-hover:text-brand transition-colors">
          {product.title}
        </h3>

        <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
          {product.categoryName} • {product.material}
        </p>
      </div>

      {/* 4. Price Row & Quick Add */}
      <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm sm:text-base font-bold text-brand">
            ₹{activeVariant?.price}
          </span>
          <span className="text-xs text-muted line-through">
            ₹{activeVariant?.mrp}
          </span>
          {activeVariant && activeVariant.discountPercent > 0 && (
            <span className="text-[10px] font-bold text-white bg-navy px-1.5 py-0.2 rounded-sm">
              {activeVariant.discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Add to Cart button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (activeVariant) {
              addToCart(product, activeVariant, 1);
            }
          }}
          className="bg-navy hover:bg-navy/90 text-white p-2 rounded-full transition-colors cursor-pointer shrink-0"
          title="Add to Cart"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
