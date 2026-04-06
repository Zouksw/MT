"use client";

import React from "react";

/**
 * SocialProof - Horizontal scrolling logo marquee
 *
 * CSS-only marquee animation (no JS library needed).
 * Shows trusted-by company names with a subtle scroll effect.
 * Fade edges with mask-image gradient.
 */
const companies = [
  "Siemens Energy",
  "ABB Group",
  "Honeywell",
  "Bosch IoT",
  "Schneider Electric",
  "GE Digital",
  "Tesla Energy",
  "Shell Digital",
  "Samsung SDS",
  "Hitachi Vantara",
];

export const SocialProof: React.FC = () => {
  // Duplicate items for seamless loop
  const items = [...companies, ...companies];

  return (
    <section className="py-10 border-t border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-sm font-medium text-gray-400 dark:text-gray-500 mb-6 tracking-wide uppercase">
          Trusted by industry leaders
        </p>

        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div
            className="absolute inset-y-0 left-0 w-24 z-10"
            style={{
              background: "linear-gradient(to right, var(--gray-50, #F8FAFC), transparent)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-24 z-10"
            style={{
              background: "linear-gradient(to left, var(--gray-50, #F8FAFC), transparent)",
            }}
          />

          {/* Marquee container */}
          <div
            className="flex items-center gap-12 whitespace-nowrap"
            style={{
              animation: "marquee 30s linear infinite",
            }}
          >
            {items.map((company, i) => (
              <span
                key={`${company}-${i}`}
                className="text-lg font-display font-semibold text-gray-300 dark:text-gray-600 select-none flex-shrink-0"
              >
                {company}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Marquee keyframes */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes marquee {
            0%, 100% { transform: translateX(0); }
          }
        }
      `}</style>
    </section>
  );
};

export default SocialProof;
