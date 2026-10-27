"use client";

import React, { useState, useMemo } from "react";
import { Header } from "../components/Header";
import { HeroBanner } from "../components/HeroBanner";
import { CategoryNav } from "../components/CategoryNav";
import { FilterSidebar, type FilterState } from "../components/FilterSidebar";
import { ProductCard } from "../components/ProductCard";
import { ProductModal } from "../components/ProductModal";
import { CartDrawer } from "../components/CartDrawer";
import { TrackOrderModal } from "../components/TrackOrderModal";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { Footer } from "../components/Footer";
import { CartProvider } from "../context/CartContext";
import { PRODUCTS, type Product } from "../data/catalog";
import { SlidersHorizontal, ArrowUpDown, X } from "lucide-react";

export default function StorefrontApp() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc" | "rating">("featured");

  const [filters, setFilters] = useState<FilterState>({
    capacity: [],
    material: [],
    usage: [],
    color: [],
    maxPrice: 2500,
  });

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((product) => {
      // 1. Category check
      if (activeCategory !== "all" && product.category !== activeCategory) {
        return false;
      }

      // 2. Max Price check
      const minVariantPrice = Math.min(...product.variants.map((v) => v.price));
      if (minVariantPrice > filters.maxPrice) {
        return false;
      }

      // 3. Material check
      if (filters.material.length > 0 && !filters.material.includes(product.material)) {
        return false;
      }

      // 4. Usage check
      if (filters.usage.length > 0 && !filters.usage.includes(product.usage)) {
        return false;
      }

      // 5. Color check
      if (filters.color.length > 0) {
        const hasColor = product.variants.some((v) =>
          Object.values(v.options).some((val) => filters.color.includes(val))
        );
        if (!hasColor) return false;
      }

      // 6. Capacity check
      if (filters.capacity.length > 0) {
        const hasCapacity = product.variants.some((v) => {
          const cap = v.options["Capacity"] || "";
          return filters.capacity.some((filterCap) => {
            if (filterCap === "< 500 ml") return parseInt(cap) < 500;
            if (filterCap === "500 ml - 750 ml") return parseInt(cap) >= 500 && parseInt(cap) <= 750;
            if (filterCap === "750 ml - 1000 ml") return (parseInt(cap) > 750 && parseInt(cap) < 1000) || cap === "1 Litre" || cap === "1 L";
            if (filterCap === "> 1 Litre") return cap.includes("1.2") || cap.includes("1.5") || cap.includes("2");
            return false;
          });
        });
        if (!hasCapacity) return false;
      }

      return true;
    }).sort((a, b) => {
      const priceA = a.variants[0]?.price || 0;
      const priceB = b.variants[0]?.price || 0;
      if (sortBy === "price-asc") return priceA - priceB;
      if (sortBy === "price-desc") return priceB - priceA;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0; // featured
    });
  }, [activeCategory, filters, sortBy]);

  const activeCategoryTitle =
    activeCategory === "all"
      ? "All Homeware & Drinkware"
      : activeCategory === "bottles"
      ? "Vacuum Thermosteel & Water Bottles"
      : activeCategory === "lunchboxes"
      ? "Insulated Lunchboxes & Tiffins"
      : activeCategory === "casseroles"
      ? "Thermal Casseroles & Hot Pots"
      : "Cookware & Kitchen Pans";

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans selection:bg-brand selection:text-white">
        {/* Header */}
        <Header
          onSelectProduct={(p) => setSelectedProduct(p)}
          onOpenTrackModal={() => setIsTrackModalOpen(true)}
          activeCategory={activeCategory}
          onSelectCategory={(cat) => setActiveCategory(cat)}
        />

        {/* Hero Section */}
        <HeroBanner onSelectCategory={(cat) => setActiveCategory(cat)} />

        {/* Circular Category Quick-Nav */}
        <CategoryNav
          activeCategory={activeCategory}
          onSelectCategory={(cat) => setActiveCategory(cat)}
        />

        {/* Main Catalog & Filter Section */}
        <main id="catalog-section" className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 pb-20 md:pb-8">
          {/* Section Header & Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-navy font-heading">
                {activeCategoryTitle}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Showing {filteredProducts.length} premium products • Multi-variant options available
              </p>
            </div>

            {/* Sorting & Mobile Filter Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className="lg:hidden flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border border-line bg-soft hover:bg-soft-hover text-navy cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
                <span className="hidden sm:inline text-muted">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-soft border border-line rounded-xl px-3 py-1.5 text-xs font-semibold text-navy focus:outline-hidden focus:border-navy cursor-pointer"
                >
                  <option value="featured">Featured / Bestsellers</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(filters.capacity.length > 0 ||
            filters.material.length > 0 ||
            filters.usage.length > 0 ||
            filters.color.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 pt-4">
              <span className="text-xs text-muted font-medium">Active filters:</span>
              {[...filters.capacity, ...filters.material, ...filters.usage, ...filters.color].map(
                (chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-navy text-white px-3 py-1 rounded-full shadow-2xs"
                  >
                    <span>{chip}</span>
                    <button
                      onClick={() => {
                        setFilters({
                          ...filters,
                          capacity: filters.capacity.filter((c) => c !== chip),
                          material: filters.material.filter((m) => m !== chip),
                          usage: filters.usage.filter((u) => u !== chip),
                          color: filters.color.filter((col) => col !== chip),
                        });
                      }}
                      className="hover:opacity-75 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              )}
            </div>
          )}

          {/* Catalog Layout: Left Filter Sidebar + Right Product Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pt-6">
            {/* Desktop Left Filter Sidebar */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-28">
                <FilterSidebar
                  filters={filters}
                  onChangeFilters={setFilters}
                  totalCount={filteredProducts.length}
                />
              </div>
            </div>

            {/* Mobile Filter Modal */}
            {isMobileFilterOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 lg:hidden">
                <div className="bg-white rounded-3xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-line">
                    <span className="text-sm font-bold text-navy">Refine Products</span>
                    <button
                      onClick={() => setIsMobileFilterOpen(false)}
                      className="w-8 h-8 rounded-full bg-soft flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <FilterSidebar
                    filters={filters}
                    onChangeFilters={setFilters}
                    totalCount={filteredProducts.length}
                  />
                  <button
                    onClick={() => setIsMobileFilterOpen(false)}
                    className="w-full bg-navy text-white text-xs font-bold py-3 rounded-full"
                  >
                    View {filteredProducts.length} Results
                  </button>
                </div>
              </div>
            )}

            {/* Product Grid */}
            <div className="lg:col-span-3">
              {filteredProducts.length === 0 ? (
                <div className="py-20 text-center space-y-3 bg-soft/50 rounded-3xl border border-line p-8">
                  <div className="text-3xl">🔍</div>
                  <h3 className="text-base font-bold text-navy">No products matched your criteria</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Try adjusting your capacity, color, or price filters to see more results.
                  </p>
                  <button
                    onClick={() => {
                      setFilters({
                        capacity: [],
                        material: [],
                        usage: [],
                        color: [],
                        maxPrice: 2500,
                      });
                      setActiveCategory("all");
                    }}
                    className="bg-navy text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-navy/90 transition-colors cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelect={(p) => setSelectedProduct(p)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Product Detail Modal (PDP) */}
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />

        {/* Slide-over Cart Drawer */}
        <CartDrawer />

        {/* Track Order Modal */}
        <TrackOrderModal
          isOpen={isTrackModalOpen}
          onClose={() => setIsTrackModalOpen(false)}
        />

        {/* Mobile Sticky Bottom Nav */}
        <MobileBottomNav onSelectCategory={(cat) => setActiveCategory(cat)} />

        {/* Footer */}
        <Footer />
      </div>
    </CartProvider>
  );
}
