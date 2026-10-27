"use client";

import React from "react";
import { Filter, X, RotateCcw } from "lucide-react";
import { COLOR_HEX } from "../data/catalog";

export interface FilterState {
  capacity: string[];
  material: string[];
  usage: string[];
  color: string[];
  maxPrice: number;
}

interface FilterSidebarProps {
  filters: FilterState;
  onChangeFilters: (filters: FilterState) => void;
  totalCount: number;
}

const CAPACITY_OPTIONS = ["< 500 ml", "500 ml - 750 ml", "750 ml - 1000 ml", "> 1 Litre"];
const MATERIAL_OPTIONS = ["SS 304 Food Grade Stainless Steel", "Pure Copper", "Borosilicate Glass", "BPA-Free Plastic", "Single-Wall Steel"];
const USAGE_OPTIONS = ["Office & Travel", "Travel & Trekking", "Daily Health & Home", "Gym & Fitness", "School & Kids", "Home & Fridge"];
const COLOR_OPTIONS = ["Pink", "Ivory", "Black", "Olive Green", "Blue", "Silver", "Red", "Copper"];

export function FilterSidebar({ filters, onChangeFilters, totalCount }: FilterSidebarProps) {
  const toggleArrayItem = (key: keyof Omit<FilterState, "maxPrice">, value: string) => {
    const current = filters[key];
    const exists = current.includes(value);
    const updated = exists ? current.filter((x) => x !== value) : [...current, value];
    onChangeFilters({ ...filters, [key]: updated });
  };

  const resetFilters = () => {
    onChangeFilters({
      capacity: [],
      material: [],
      usage: [],
      color: [],
      maxPrice: 2500,
    });
  };

  const hasActiveFilters =
    filters.capacity.length > 0 ||
    filters.material.length > 0 ||
    filters.usage.length > 0 ||
    filters.color.length > 0 ||
    filters.maxPrice < 2500;

  return (
    <aside className="w-full space-y-6">
      {/* Filter Header */}
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-navy" />
          <h3 className="text-sm font-bold text-navy uppercase tracking-wider">
            Filters ({totalCount})
          </h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* 1. Price Filter Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-navy">
          <span>Max Price</span>
          <span className="text-brand font-bold">₹{filters.maxPrice}</span>
        </div>
        <input
          type="range"
          min={250}
          max={2500}
          step={50}
          value={filters.maxPrice}
          onChange={(e) => onChangeFilters({ ...filters, maxPrice: Number(e.target.value) })}
          className="w-full accent-brand cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-muted">
          <span>₹250</span>
          <span>₹2,500</span>
        </div>
      </div>

      {/* 2. Capacity Filter */}
      <div className="space-y-2.5 pt-4 border-t border-line/60">
        <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Capacity</h4>
        <div className="space-y-1.5">
          {CAPACITY_OPTIONS.map((cap) => {
            const checked = filters.capacity.includes(cap);
            return (
              <label
                key={cap}
                className="flex items-center gap-2.5 text-xs text-navy hover:text-brand cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleArrayItem("capacity", cap)}
                  className="rounded-sm accent-brand w-3.5 h-3.5 cursor-pointer"
                />
                <span>{cap}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Colour Swatches Filter */}
      <div className="space-y-2.5 pt-4 border-t border-line/60">
        <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Colour</h4>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((c) => {
            const isSelected = filters.color.includes(c);
            const hex = COLOR_HEX[c] ?? "#ccc";
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleArrayItem("color", c)}
                title={c}
                className={`relative w-7 h-7 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
                  isSelected ? "ring-2 ring-navy ring-offset-1 scale-110" : "border-line"
                }`}
                style={{ backgroundColor: hex }}
              >
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Material Filter */}
      <div className="space-y-2.5 pt-4 border-t border-line/60">
        <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Material</h4>
        <div className="space-y-1.5">
          {MATERIAL_OPTIONS.map((mat) => {
            const checked = filters.material.includes(mat);
            return (
              <label
                key={mat}
                className="flex items-center gap-2.5 text-xs text-navy hover:text-brand cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleArrayItem("material", mat)}
                  className="rounded-sm accent-brand w-3.5 h-3.5 cursor-pointer"
                />
                <span className="truncate">{mat}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 5. Usage Occasion Filter */}
      <div className="space-y-2.5 pt-4 border-t border-line/60">
        <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Usage & Occasion</h4>
        <div className="space-y-1.5">
          {USAGE_OPTIONS.map((u) => {
            const checked = filters.usage.includes(u);
            return (
              <label
                key={u}
                className="flex items-center gap-2.5 text-xs text-navy hover:text-brand cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleArrayItem("usage", u)}
                  className="rounded-sm accent-brand w-3.5 h-3.5 cursor-pointer"
                />
                <span>{u}</span>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
