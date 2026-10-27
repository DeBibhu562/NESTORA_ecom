"use client";

import React, { useState } from "react";
import {
  X,
  Star,
  ShieldCheck,
  Flame,
  Droplets,
  Truck,
  RotateCcw,
  Tag,
  Check,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import type { Product, ProductVariant } from "../data/catalog";
import { COLOR_HEX } from "../data/catalog";
import { useCart } from "../context/CartContext";

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const { addToCart } = useCart();

  if (!product) return null;

  // Initialize selected options with first variant's options
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    return product.variants[0]?.options || {};
  });

  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string>(product.featuredImage);
  const [activeTab, setActiveTab] = useState<"desc" | "specs" | "shipping">("desc");

  // Pincode state
  const [pincode, setPincode] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<string | null>(null);

  // Personalization state
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [customName, setCustomName] = useState("");

  // Resolve active variant from selected options
  const activeVariant: ProductVariant =
    product.variants.find((v) => {
      return Object.entries(selectedOptions).every(([optName, optVal]) => v.options[optName] === optVal);
    }) || product.variants[0]!;

  // Update image when variant changes if active image hasn't been manually set to another angle
  const handleOptionChange = (optionName: string, value: string) => {
    const updated = { ...selectedOptions, [optionName]: value };
    setSelectedOptions(updated);

    // If changing color/finish, update image to matching variant image
    if (optionName === "Colour" || optionName === "Color" || optionName === "Finish" || optionName === "Character") {
      const matchingVariant = product.variants.find(
        (v) => v.options[optionName] === value
      );
      if (matchingVariant?.imageUrl) {
        setActiveImage(matchingVariant.imageUrl);
      }
    }
  };

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(pincode.trim())) {
      setPincodeStatus("Delivery by Thursday, 29 Oct • Free Delivery Available");
    } else {
      setPincodeStatus("Please enter a valid 6-digit Indian PIN code");
    }
  };

  const isOutOfStock = activeVariant.inventory <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, activeVariant, quantity, isPersonalized ? customName : undefined);
    onClose();
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addToCart(product, activeVariant, quantity, isPersonalized ? customName : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-line overflow-hidden my-auto max-h-[94vh] flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-soft hover:bg-soft-hover border border-line text-navy flex items-center justify-center cursor-pointer transition-colors shadow-xs"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* 1. Left Gallery Column */}
        <div className="w-full md:w-1/2 bg-soft/40 p-3 sm:p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-line shrink-0">
          {/* Main Visual Display with Engraving Preview */}
          <div className="relative w-full h-44 sm:h-64 md:h-auto md:aspect-square md:flex-1 rounded-xl sm:rounded-2xl bg-white p-3 sm:p-6 border border-line/60 flex items-center justify-center overflow-hidden">
            <img
              src={activeImage || activeVariant.imageUrl}
              alt={product.title}
              className="h-full w-full object-contain filter drop-shadow-md"
            />

            {/* Live Name Engraving overlay on the bottle */}
            {isPersonalized && customName.trim() && (
              <div className="absolute inset-x-0 bottom-16 sm:bottom-24 text-center pointer-events-none">
                <span className="inline-block bg-black/60 backdrop-blur-xs text-white text-[10px] sm:text-xs font-serif italic px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-sm tracking-widest uppercase border border-white/40 shadow-md">
                  {customName}
                </span>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1">
              <span className="bg-brand text-white text-[9px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                Save {activeVariant.discountPercent}%
              </span>
              {activeVariant.inventory < 10 && activeVariant.inventory > 0 && (
                <span className="bg-amber-600 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  Only {activeVariant.inventory} left
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail Gallery Row */}
          <div className="flex gap-2 mt-2.5 sm:mt-4 overflow-x-auto scrollbar-none py-1">
            {product.galleryImages.map((imgUrl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(imgUrl)}
                className={`w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border p-1 bg-white cursor-pointer transition-all shrink-0 ${
                  activeImage === imgUrl ? "ring-2 ring-navy border-transparent" : "border-line hover:border-navy/40"
                }`}
              >
                <img src={imgUrl} alt="" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>

          {/* Value props banner */}
          <div className="hidden sm:grid mt-4 pt-3 border-t border-line/60 grid-cols-3 gap-2 text-center text-[11px] text-navy font-medium">
            <div className="flex flex-col items-center">
              <Flame className="w-4 h-4 text-brand mb-0.5" />
              <span>24h Hot & Cold</span>
            </div>
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mb-0.5" />
              <span>SS 304 Steel</span>
            </div>
            <div className="flex flex-col items-center">
              <Droplets className="w-4 h-4 text-sky-600 mb-0.5" />
              <span>100% Leakproof</span>
            </div>
          </div>
        </div>

        {/* 2. Right Buy Box & Specification Column */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted mb-1">
              <span>{product.categoryName}</span>
              <span>•</span>
              <div className="flex items-center text-gold">
                <Star className="w-3.5 h-3.5 fill-gold stroke-none" />
                <span className="ml-1 text-navy">{product.rating}</span>
                <span className="text-muted ml-0.5">({product.reviewCount} reviews)</span>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-navy font-heading leading-snug">
              {product.title}
            </h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {product.tagline}
            </p>
          </div>

          {/* Pricing Row */}
          <div className="p-3.5 rounded-2xl bg-soft border border-line">
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl font-black text-brand">
                ₹{activeVariant.price}
              </span>
              <span className="text-sm text-muted line-through">
                ₹{activeVariant.mrp}
              </span>
              <span className="bg-navy text-white text-xs font-bold px-2 py-0.5 rounded-sm">
                {activeVariant.discountPercent}% OFF
              </span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              Inclusive of all taxes. Free Shipping on orders above ₹699.
            </p>

            {/* Special Coupon Highlight */}
            <div className="mt-2.5 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-navy font-semibold">
                <Tag className="w-3.5 h-3.5 text-brand" />
                <span>Get this for ₹{Math.round(activeVariant.price * 0.85)}</span>
              </div>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-sm">
                Use code DIWALI15
              </span>
            </div>
          </div>

          {/* Dynamic Variant Selectors */}
          <div className="space-y-4">
            {product.options.map((option) => (
              <div key={option.name} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-navy">
                  <span>
                    Select {option.name}:{" "}
                    <span className="font-bold text-brand">
                      {selectedOptions[option.name] || activeVariant.options[option.name]}
                    </span>
                  </span>
                </div>

                {/* Option Pill Buttons */}
                {option.displayAs === "PILL" && (
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((v) => {
                      const isSelected = selectedOptions[option.name] === v.value;
                      return (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => handleOptionChange(option.name, v.value)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-navy text-white border-navy shadow-xs"
                              : "bg-white hover:bg-soft text-navy border-line"
                          }`}
                        >
                          {v.value}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Color Swatch Buttons */}
                {option.displayAs === "SWATCH" && (
                  <div className="flex items-center gap-2.5">
                    {option.values.map((v) => {
                      const isSelected = selectedOptions[option.name] === v.value;
                      const hex = v.hexColor || COLOR_HEX[v.value] || "#bbb";
                      return (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => handleOptionChange(option.name, v.value)}
                          title={v.value}
                          className={`w-7 h-7 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "ring-2 ring-navy ring-offset-2 scale-110"
                              : "border-line hover:scale-105"
                          }`}
                          style={{ backgroundColor: hex }}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white filter drop-shadow-xs" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Laser Personalization Option */}
          {product.personalizationAvailable && (
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-bold text-navy cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPersonalized}
                  onChange={(e) => setIsPersonalized(e.target.checked)}
                  className="rounded-sm accent-brand w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gold" />
                  Add Custom Laser Engraved Name (+₹99)
                </span>
              </label>

              {isPersonalized && (
                <div className="space-y-1 pt-1">
                  <input
                    type="text"
                    maxLength={15}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Enter name to engrave (max 15 chars)"
                    className="w-full bg-white rounded-xl px-3 py-2 text-xs text-navy border border-amber-300 focus:outline-hidden focus:border-navy"
                  />
                  <div className="text-[10px] text-muted">
                    Preview rendered directly on bottle illustration.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pincode Delivery Estimator */}
          <div className="space-y-2 pt-2 border-t border-line/60">
            <div className="text-xs font-bold text-navy flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-brand" />
              <span>Check Delivery Pincode</span>
            </div>
            <form onSubmit={handleCheckPincode} className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Enter 6-digit PIN code (e.g. 110001)"
                className="flex-1 bg-soft rounded-xl px-3 py-2 text-xs text-navy border border-line focus:outline-hidden focus:border-navy"
              />
              <button
                type="submit"
                className="bg-navy hover:bg-navy/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Check
              </button>
            </form>
            {pincodeStatus && (
              <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                {pincodeStatus}
              </p>
            )}
          </div>

          {/* Quantity Stepper & Primary CTAs */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center gap-3">
              {/* Stepper */}
              <div className="flex items-center border border-line rounded-full bg-soft px-2 py-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-full hover:bg-white text-navy font-bold flex items-center justify-center cursor-pointer transition-colors"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-bold text-navy">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-7 h-7 rounded-full hover:bg-white text-navy font-bold flex items-center justify-center cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>

              {/* Add to Cart */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 bg-white hover:bg-soft text-navy border border-navy/30 py-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isOutOfStock ? "Out of Stock" : "Add to Cart"}</span>
              </button>
            </div>

            {/* Buy It Now (Gokwik 1-click CTA) */}
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isOutOfStock}
              className="w-full bg-navy hover:bg-navy/90 text-white py-3.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isOutOfStock ? "Notify When Available" : "Buy It Now • Instant Checkout"}</span>
            </button>
          </div>

          {/* Accordion Tabs (Description, Specs, Warranty) */}
          <div className="pt-4 border-t border-line/60">
            <div className="flex border-b border-line text-xs font-semibold">
              <button
                onClick={() => setActiveTab("desc")}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === "desc"
                    ? "border-navy text-navy font-bold"
                    : "border-transparent text-muted hover:text-navy"
                }`}
              >
                Description
              </button>
              <button
                onClick={() => setActiveTab("specs")}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === "specs"
                    ? "border-navy text-navy font-bold"
                    : "border-transparent text-muted hover:text-navy"
                }`}
              >
                Specifications
              </button>
              <button
                onClick={() => setActiveTab("shipping")}
                className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  activeTab === "shipping"
                    ? "border-navy text-navy font-bold"
                    : "border-transparent text-muted hover:text-navy"
                }`}
              >
                Shipping & Warranty
              </button>
            </div>

            <div className="py-3 text-xs text-navy leading-relaxed">
              {activeTab === "desc" && (
                <div
                  dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
                  className="space-y-2"
                />
              )}
              {activeTab === "specs" && (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-soft rounded-lg">
                    <dt className="text-[10px] text-muted uppercase font-bold">Inner Material</dt>
                    <dd className="font-semibold text-navy mt-0.5">{product.specifications.innerMaterial}</dd>
                  </div>
                  <div className="p-2 bg-soft rounded-lg">
                    <dt className="text-[10px] text-muted uppercase font-bold">Outer Material</dt>
                    <dd className="font-semibold text-navy mt-0.5">{product.specifications.outerMaterial}</dd>
                  </div>
                  <div className="p-2 bg-soft rounded-lg">
                    <dt className="text-[10px] text-muted uppercase font-bold">Insulation Tech</dt>
                    <dd className="font-semibold text-navy mt-0.5">{product.specifications.insulation}</dd>
                  </div>
                  <div className="p-2 bg-soft rounded-lg">
                    <dt className="text-[10px] text-muted uppercase font-bold">Leak Proof</dt>
                    <dd className="font-semibold text-navy mt-0.5">{product.specifications.leakProof ? "100% Guaranteed" : "Standard Lid"}</dd>
                  </div>
                  <div className="p-2 bg-soft rounded-lg col-span-2">
                    <dt className="text-[10px] text-muted uppercase font-bold">Care Instructions</dt>
                    <dd className="font-medium text-navy mt-0.5">{product.specifications.careInstructions}</dd>
                  </div>
                </dl>
              )}
              {activeTab === "shipping" && (
                <div className="space-y-2 text-xs">
                  <p>✓ <strong>Warranty:</strong> {product.warrantyMonths} Months Manufacturer Guarantee against vacuum failure.</p>
                  <p>✓ <strong>Returns:</strong> 7-Day Hassle-Free Replacement if received damaged or defective.</p>
                  <p>✓ <strong>Delivery:</strong> Dispatched within 24 hours from verified warehouse.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
