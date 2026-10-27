"use client";

import React from "react";
import { ShieldCheck, Truck, RotateCcw, Headphones, Heart } from "lucide-react";
import { NestoraLogo } from "./NestoraLogo";

export function Footer() {
  return (
    <footer className="bg-navy text-white pt-12 pb-20 md:pb-12 border-t border-navy/80">
      {/* 1. Value Proposition Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-10 border-b border-white/10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-brand" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">Free Delivery</div>
            <div className="text-[11px] text-gray-300">On all orders above ₹699</div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">1 Year Warranty</div>
            <div className="text-[11px] text-gray-300">100% genuine SS 304 products</div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">7 Days Return</div>
            <div className="text-[11px] text-gray-300">Hassle-free replacement</div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5 text-gold" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">Dedicated Support</div>
            <div className="text-[11px] text-gray-300">Mon-Sat (9 AM to 6 PM)</div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 text-xs text-gray-300">
        <div className="lg:col-span-2 space-y-3">
          <NestoraLogo variant="footer" />
          <p className="text-xs text-gray-300 max-w-sm leading-relaxed">
            For over five decades, Nestora has been at the heart of millions of homes, crafting high-performance
            vacuum thermosteel flasks, insulated casseroles, and innovative kitchenware designed to make life smoother.
          </p>
          <div className="text-[11px] text-gray-400">
            BIS License • ISO 9001:2015 Certified
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Bottles & Flasks
          </h4>
          <ul className="space-y-2">
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Vacuum Thermosteel</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Ayurvedic Copper Bottles</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Single-Wall Steel</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Sports Gym Sippers</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Kids Flasks & Sippers</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Kitchen & Dining
          </h4>
          <ul className="space-y-2">
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Insulated Lunchboxes</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Thermal Casseroles</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Triply Cookware & Pans</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Glass Jars & Canisters</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Corporate Gifting</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Customer Care
          </h4>
          <ul className="space-y-2">
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Track Order Status</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Warranty Registration</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Shipping & Returns Policy</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Spare Parts & Lids</a></li>
            <li><a href="#catalog-section" className="hover:text-white transition-colors">Contact Helpline</a></li>
          </ul>
        </div>
      </div>

      {/* 3. Bottom Legal & Copyright */}
      <div className="max-w-7xl mx-auto px-4 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-400">
        <div>
          © {new Date().getFullYear()} NESTORA Homewares. All rights reserved.
        </div>
        <div className="flex items-center gap-1">
          Crafted with <Heart className="w-3 h-3 text-brand fill-brand" /> for everyday homes.
        </div>
      </div>
    </footer>
  );
}
