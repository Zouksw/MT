"use client";

import React, { useEffect, useRef } from "react";
import {
  ArrowRightOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { Button } from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";

/**
 * Animated sparkline — a tiny live-data visualization that communicates
 * "this is a serious data product" at first glance.
 */
const DATA_STREAM = [
  12, 19, 15, 25, 22, 30, 28, 35, 32, 40, 38, 45, 42, 50, 48, 55, 52, 60,
  58, 65, 62, 70, 68, 75, 72, 80, 78, 85, 82, 90,
];

function SparklineHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const offset = offsetRef.current;
      const visiblePoints = 60;
      const step = W / visiblePoints;

      // Draw multiple data lines for richness
      const lines = [
        { data: DATA_STREAM, color: "rgba(0, 102, 204, 0.6)", width: 2 },
        { data: DATA_STREAM.map((v) => v * 0.7 + 10), color: "rgba(59, 130, 246, 0.35)", width: 1.5 },
        { data: DATA_STREAM.map((v) => v * 0.5 + 20), color: "rgba(14, 165, 233, 0.2)", width: 1 },
      ];

      lines.forEach(({ data, color, width: lw }) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        for (let i = 0; i < visiblePoints; i++) {
          const idx = Math.floor((i + offset) % data.length);
          const nextIdx = (idx + 1) % data.length;
          const progress = (i + offset) % 1;
          const value = data[idx] * (1 - progress) + data[nextIdx] * progress;
          const x = i * step;
          const y = H - (value / 100) * H * 0.8 - H * 0.1;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // Draw a subtle glow dot at the leading edge
      const lastIdx = Math.floor((visiblePoints - 1 + offset) % DATA_STREAM.length);
      const lastY = H - (DATA_STREAM[lastIdx] / 100) * H * 0.8 - H * 0.1;
      const lastX = (visiblePoints - 1) * step;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 102, 204, 0.9)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 102, 204, 0.15)";
      ctx.fill();

      offsetRef.current += 0.15;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-48 md:h-64 lg:h-80 opacity-80"
      style={{ display: "block" }}
    />
  );
}

const features = [
  {
    icon: <ThunderboltOutlined />,
    title: "Lightning Fast",
    description: "Millions of data points per second with sub-millisecond latency",
    color: "bg-primary",
  },
  {
    icon: <LineChartOutlined />,
    title: "AI-Powered Insights",
    description: "Built-in anomaly detection and forecasting with ML",
    color: "bg-indigo-500",
  },
  {
    icon: <SafetyOutlined />,
    title: "Enterprise Security",
    description: "End-to-end encryption, RBAC, and comprehensive audit logs",
    color: "bg-sky-500",
  },
];

/**
 * Hero Section — Data-product-first design
 *
 * Replaces generic gradient orbs with a live data stream visualization.
 * Uses Tailwind utilities and the design system Button component.
 */
export const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-white dark:bg-gray-900">
      {/* Subtle radial gradient for depth — NOT floating orbs */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 102, 204, 0.2), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:py-24 lg:py-32">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary">
          <ThunderboltOutlined className="text-xs" />
          Enterprise-Grade Time Series Platform
        </div>

        {/* Headline */}
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-white md:text-5xl lg:text-7xl">
          Real-Time Analytics
          <br />
          <span className="text-primary">at Any Scale</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-gray-500 dark:text-gray-400 md:text-xl">
          High-performance time series data platform with built-in anomaly detection,
          forecasting, and real-time monitoring.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Button size="lg" icon={<ArrowRightOutlined />}>
            <a href="/register">Get Started Free</a>
          </Button>
          <a href="#features">
            <Button variant="ghost" size="lg">
              View Demo
            </Button>
          </a>
        </div>

        {/* Floating Metrics Bar */}
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-gray-400 dark:text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold text-base">10M+</span>
            <span>Data Points/sec</span>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold text-base">&lt;1ms</span>
            <span>Latency</span>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold text-base">99.99%</span>
            <span>Uptime</span>
          </div>
        </div>

        {/* Data Stream Visualization */}
        <div className="mt-16 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Live Data Stream
            </span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Streaming</span>
            </div>
          </div>
          <SparklineHero />
        </div>

        {/* Feature Cards */}
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {features.map((feature, i) => (
            <GlassCard
              key={i}
              intensity="light"
              className="group transition-all duration-200 hover:shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.06)_0px_4px_4px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px] relative"
            >
              {/* Large faded number prefix */}
              <div className="absolute top-2 right-4 text-7xl font-display font-semibold text-gray-100 dark:text-gray-800/60 select-none leading-none">
                0{i + 1}
              </div>
              <div className="p-5 md:p-6 relative z-10">
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg text-xl text-white ${feature.color} transition-transform duration-200 group-hover:scale-110`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
