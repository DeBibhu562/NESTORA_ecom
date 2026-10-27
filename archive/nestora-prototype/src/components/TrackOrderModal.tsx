"use client";

import React, { useState } from "react";
import { X, Truck, CheckCircle2, PackageCheck, Clock } from "lucide-react";

interface TrackOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TrackOrderModal({ isOpen, onClose }: TrackOrderModalProps) {
  const [query, setQuery] = useState("MLT-894210");
  const [trackingData, setTrackingData] = useState<boolean>(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-line space-y-5 animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-soft text-navy flex items-center justify-center">
              <Truck className="w-4 h-4 text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy">Track Your Order</h3>
              <p className="text-[11px] text-muted">Real-time Nestora shipment updates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-soft hover:bg-soft-hover text-navy flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-navy block">Order ID or Mobile Number</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. MLT-894210 or 9876543210"
              className="flex-1 bg-soft rounded-xl px-3 py-2 text-xs text-navy border border-line focus:outline-hidden focus:border-navy"
            />
            <button
              onClick={() => setTrackingData(true)}
              className="bg-navy hover:bg-navy/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Track
            </button>
          </div>
        </div>

        {/* Shipment Status Display */}
        {trackingData && (
          <div className="p-4 rounded-2xl bg-soft border border-line space-y-4">
            <div className="flex justify-between items-start text-xs border-b border-line/60 pb-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted">Tracking AWB</span>
                <div className="font-bold text-navy">BLUEDART-849204128</div>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Out for Delivery
              </span>
            </div>

            {/* Stepper Timeline */}
            <div className="space-y-3 text-xs">
              <div className="flex gap-3 items-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-navy">Order Placed & Verified</div>
                  <div className="text-[10px] text-muted">24 Oct, 10:30 AM</div>
                </div>
              </div>

              <div className="flex gap-3 items-center">
                <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-navy">Packed & Dispatched from Hub</div>
                  <div className="text-[10px] text-muted">25 Oct, 04:15 PM • Mumbai Central Hub</div>
                </div>
              </div>

              <div className="flex gap-3 items-center">
                <Truck className="w-4 h-4 text-brand shrink-0" />
                <div className="flex-1">
                  <div className="font-bold text-brand">Out for Delivery</div>
                  <div className="text-[10px] text-muted">Courier executive assigned • Expected by 5:00 PM</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-navy text-white text-xs font-semibold py-2.5 rounded-full hover:bg-navy/90 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
