"use client";

import React from "react";
import { CATEGORIES } from "../data/catalog";

interface CategoryNavProps {
  activeCategory: string;
  onSelectCategory: (id: string) => void;
}

const CATEGORY_ITEMS = [
  { id: "all", name: "All Homeware", icon: "🏠", count: 16 },
  { id: "bottles", name: "Water Bottles", icon: "🍼", count: 12, highlight: true },
  { id: "lunchboxes", name: "Lunchboxes", icon: "🍱", count: 2 },
  { id: "casseroles", name: "Casseroles", icon: "🍲", count: 1 },
  { id: "cookware", name: "Cookware", icon: "🍳", count: 1 },
];

export function CategoryNav({ activeCategory, onSelectCategory }: CategoryNavProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-6 border-b border-line/60">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-navy uppercase tracking-wider">
          Explore by Category
        </h2>
        <span className="text-xs text-muted">Currently featuring Bottles & scalable kitchenware</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {CATEGORY_ITEMS.map((item) => {
          const isActive = activeCategory === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectCategory(item.id)}
              className={`flex flex-col items-center p-3 rounded-2xl border transition-all cursor-pointer text-center group ${
                isActive
                  ? "bg-navy text-white border-navy shadow-sm"
                  : "bg-white hover:bg-soft text-navy border-line hover:border-navy/30"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 transition-transform group-hover:scale-110 ${
                  isActive ? "bg-white/20" : "bg-soft border border-line"
                }`}
              >
                {item.icon}
              </div>
              <span className="text-xs font-semibold leading-tight line-clamp-1">
                {item.name}
              </span>
              <span
                className={`text-[10px] mt-0.5 ${
                  isActive ? "text-white/80" : "text-muted"
                }`}
              >
                {item.count} Products
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
