"use client";

import React from "react";
import { ShieldCheck, Flame, Droplets, Sparkles, ArrowRight } from "lucide-react";

interface HeroBannerProps {
  onSelectCategory: (cat: string) => void;
}

export function HeroBanner({ onSelectCategory }: HeroBannerProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-soft to-white border-b border-line py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text & Value Props */}
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>India's Most Trusted Homeware Since 1972</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-navy tracking-tight font-heading leading-tight">
              Timeless Quality, <br className="hidden sm:inline" />
              <span className="text-brand">Engineered</span> for Every Sip.
            </h1>

            <p className="text-sm sm:text-base text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Explore Nestora&apos;s signature Vacuum Thermosteel collection. Built with certified SS 304
              food-grade stainless steel, internal copper shield technology, and 24-hour hot & cold retention.
            </p>

            {/* Quick Action CTAs */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={() => onSelectCategory("bottles")}
                className="bg-navy hover:bg-navy/90 text-white px-6 py-3 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>Shop Thermosteel Bottles</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSelectCategory("all")}
                className="bg-white hover:bg-soft text-navy border border-line px-5 py-3 rounded-full text-sm font-semibold transition-all cursor-pointer"
              >
                View All Categories
              </button>
            </div>

            {/* Trust Pill Ribbon */}
            <div className="pt-4 border-t border-line/60 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-navy font-medium">
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <Flame className="w-4 h-4 text-brand shrink-0" />
                <span>24h Hot & Cold</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>SS 304 Food Grade</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start col-span-2 sm:col-span-1">
                <Droplets className="w-4 h-4 text-sky-600 shrink-0" />
                <span>100% Leak-Proof</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual Showcase */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-sm sm:max-w-md aspect-square rounded-3xl bg-soft/80 p-6 border border-line shadow-xs flex items-center justify-center">
              <div className="absolute top-4 right-4 bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-sm">
                Save up to 25%
              </div>
              <img
                src="https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg"
                alt="Nestora Felice Thermosteel Bottle"
                className="w-full h-full object-contain filter drop-shadow-xl hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-line shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-navy">Aero Thermosteel 550ml</div>
                  <div className="text-[11px] text-muted">Pink • 24h Hot & Cold</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-brand">₹802</div>
                  <div className="text-[10px] text-muted line-through">₹980</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
