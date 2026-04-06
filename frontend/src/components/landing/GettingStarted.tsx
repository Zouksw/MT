"use client";

import React from "react";
import {
  CheckCircleOutlined,
  RocketOutlined,
  CloudServerOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { Button } from "@/components/ui/Button";
import { useIsMobile } from "@/lib/responsive-utils";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Create Your Account",
    description: "Sign up for a free account and set up your organization. No credit card required.",
    icon: <RocketOutlined />,
    color: "bg-primary",
  },
  {
    number: 2,
    title: "Connect Your Data",
    description: "Connect your IoTDB instance or start fresh. Import from CSV, JSON, or use the REST API.",
    icon: <CloudServerOutlined />,
    color: "bg-blue-500",
  },
  {
    number: 3,
    title: "Configure & Customize",
    description: "Set up alerts, create dashboards, and configure AI models for forecasting and detection.",
    icon: <SettingOutlined />,
    color: "bg-violet-500",
  },
  {
    number: 4,
    title: "Scale & Automate",
    description: "Enable automated monitoring, API integrations, and scale your infrastructure as needed.",
    icon: <ThunderboltOutlined />,
    color: "bg-amber-500",
  },
];

const features = [
  "5-minute quick start",
  "Interactive tutorials",
  "Dashboard templates",
  "Sample datasets",
  "Community support",
  "API documentation",
];

export default function GettingStarted() {
  const isMobile = useIsMobile();

  return (
    <section className="bg-white dark:bg-gray-900 px-6 py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16 lg:mb-20">
          <div className="mb-4 inline-block rounded border border-primary/20 bg-primary/8 px-4 py-1.5">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Quick Start
            </span>
          </div>
          <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white md:text-4xl lg:text-5xl">
            Get Started in Minutes
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-gray-500 dark:text-gray-400">
            Set up your time series database platform with our streamlined onboarding
          </p>
        </div>

        {/* Steps */}
        <div className="relative mb-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Dashed connector — only between steps on desktop */}
              {!isMobile && index < steps.length - 1 && (
                <div className="absolute right-0 top-1/2 hidden h-px w-8 -translate-y-1/2 border-t-2 border-dashed border-gray-200 dark:border-gray-700 lg:block" />
              )}

              <div className="group rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 p-6 pt-10 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                {/* Step number badge */}
                <div
                  className={`absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ${step.color}`}
                >
                  {step.number}
                </div>

                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 text-xl ${step.color.replace("bg-", "text-").replace("500", "400")}`}>
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature List */}
        <div className="mx-auto mb-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-4"
            >
              <CheckCircleOutlined className="text-lg text-green-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button size="lg" icon={<ArrowRightOutlined />}>
            <a href="/register">Start Your Free Trial</a>
          </Button>
          <p className="mt-4 text-sm text-gray-400">
            No credit card required &middot; 14-day free trial &middot; Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
