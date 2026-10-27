"use client";

import React from "react";

interface NestoraLogoProps {
  variant?: "header" | "footer" | "compact";
  className?: string;
}

export function NestoraLogo({ variant = "header", className = "" }: NestoraLogoProps) {
  const isFooter = variant === "footer";

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Vector Shield & 'N' Flask Emblem */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 38 42"
          className={variant === "compact" ? "w-7 h-8" : isFooter ? "w-9 h-10" : "w-8 sm:w-9 h-9 sm:h-10"}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Shield Outline */}
          <path
            d="M3 8 L19 2 L35 8 V22 C35 31.5 19 39.5 19 39.5 C19 39.5 3 31.5 3 22 Z"
            fill={isFooter ? "rgba(255,255,255,0.06)" : "#f7f7f5"}
            stroke={isFooter ? "rgba(255,255,255,0.25)" : "#072835"}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />

          {/* Inner Crimson Flask Outline */}
          <rect
            x="16.5"
            y="7"
            width="5"
            height="3"
            rx="1"
            fill="#c4301c"
          />
          <path
            d="M14 10 H24 V27 C24 29 21.5 30.5 19 30.5 C16.5 30.5 14 29 14 27 Z"
            fill={isFooter ? "#c4301c" : "#c4301c"}
            fillOpacity="0.18"
            stroke="#c4301c"
            strokeWidth="1.2"
          />

          {/* Monogram Stylized 'N' */}
          <path
            d="M10 13 H13.5 V28 H10 Z"
            fill={isFooter ? "#ffffff" : "#072835"}
          />
          <path
            d="M12.5 13 L24.5 27 H26.5 L14.5 13 Z"
            fill="#c4301c"
          />
          <path
            d="M24 13 H27.5 V28 H24 Z"
            fill={isFooter ? "#ffffff" : "#072835"}
          />
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-black tracking-tight font-heading ${
              isFooter
                ? "text-2xl text-white tracking-wide"
                : "text-xl sm:text-2xl text-navy tracking-tight"
            }`}
          >
            NESTORA
          </span>
          <span className="text-[10px] font-bold text-brand uppercase tracking-wider">
            ™
          </span>
        </div>
        <span
          className={`text-[9px] sm:text-[10px] font-medium tracking-[0.18em] uppercase ${
            isFooter ? "text-gray-400" : "text-muted"
          }`}
        >
          Homewares • Since 1972
        </span>
      </div>
    </div>
  );
}
