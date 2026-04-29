"use client";

import type React from "react";
import { useState } from "react";
import {
  Cloud,
  Lightning,
  ShieldCheck,
  Plugs,
  Users,
  Bell,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { MotionReveal } from "@/components/ui/MotionReveal";
import { SPRING_DEFAULTS } from "@/lib/motion";

interface FAQItem {
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    question: "What is MT?",
    answer:
      "MT is a commodity market information and analytics platform. It tracks 55+ commodities with real-time prices, multi-factor analysis (weather, forex, tariffs, shipping), and an AI signal engine with 7 models that generate independent price predictions.",
    icon: <Cloud size={20} weight="duotone" />,
  },
  {
    question: "How does the AI signal engine work?",
    answer:
      "Our platform runs 7 independent AI models — ARIMA, HoltWinters, ExponentialSmoothing, Naive, STL, Timer-XL, and Sundial — on each commodity. Each model generates its own price forecast and signal (bullish/bearish/neutral) with a confidence score. You can compare model accuracy using MAPE metrics.",
    icon: <Lightning size={20} weight="duotone" />,
  },
  {
    question: "What commodities are covered?",
    answer:
      "We cover 55+ commodities including beef and livestock, grains and oilseeds (corn, soybeans, wheat), energy (crude oil, natural gas), metals (gold, silver, copper), and soft commodities (coffee, sugar, cotton). Coverage is expanding regularly.",
    icon: <ShieldCheck size={20} weight="duotone" />,
  },
  {
    question: "What market factors do you analyze?",
    answer:
      "We track weather patterns, currency exchange rates, import/export tariffs, shipping and freight costs, and supply/demand fundamentals. Each factor's correlation with commodity prices is visualized so you can see what's driving movements.",
    icon: <Plugs size={20} weight="duotone" />,
  },
  {
    question: "Is this a trading platform?",
    answer:
      "No. MT is an information and analytics platform. We provide data, analysis, and AI-generated signals to inform your decisions. We do not execute trades, manage accounts, or handle funds.",
    icon: <Users size={20} weight="duotone" />,
  },
  {
    question: "Can I set up price alerts?",
    answer:
      "Yes. You can configure custom price thresholds for any commodity. When a price hits your target or an AI model detects a breakout or reversal, you receive an instant notification with details and severity level.",
    icon: <Bell size={20} weight="duotone" />,
  },
];

export default function FAQ() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <section id="faq" className="bg-white dark:bg-gray-900 px-6 py-24 md:py-36 lg:py-48">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 md:mb-16">
          <MotionReveal>
            <span className="mb-4 inline-block rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-muted text-muted-foreground">
              FAQ
            </span>
          </MotionReveal>
          <MotionReveal delay={0.1}>
            <h2 className="font-display text-3xl font-semibold text-gray-900 dark:text-white md:text-4xl" style={{ letterSpacing: "-0.04em" }}>
              Frequently Asked Questions
            </h2>
          </MotionReveal>
          <MotionReveal delay={0.15}>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need to know about MT
            </p>
          </MotionReveal>
        </div>

        {/* Side-by-side layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Left: Questions list */}
          <MotionReveal>
            <div className="space-y-1" role="tablist" aria-label="FAQ questions">
              {faqs.map((faq, index) => (
                <button
                  key={index}
                  role="tab"
                  aria-selected={selectedIndex === index}
                  onClick={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200 border-l-2 ${
                    selectedIndex === index
                      ? "bg-primary/5 border-l-primary text-primary"
                      : "border-l-transparent text-foreground hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-l-gray-300"
                  }`}
                >
                  <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    selectedIndex === index ? "bg-primary/15 text-primary" : "bg-muted text-gray-400"
                  }`}>
                    {faq.icon}
                  </div>
                  <span className={`text-sm font-medium ${selectedIndex === index ? "text-primary" : ""}`}>
                    {faq.question}
                  </span>
                </button>
              ))}
            </div>
          </MotionReveal>

          {/* Right: Selected answer */}
          <div className="min-h-[320px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={SPRING_DEFAULTS}
                className="rounded-2xl outline outline-black/5 dark:outline-white/10 bg-white dark:bg-gray-950 p-6 md:p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {faqs[selectedIndex].icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {faqs[selectedIndex].question}
                  </h3>
                </div>
                <p className="text-base leading-relaxed text-foreground">
                  {faqs[selectedIndex].answer}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Contact CTA */}
        <MotionReveal className="mt-12 md:mt-16">
          <div className="rounded-2xl outline outline-black/5 dark:outline-white/10 p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Still have questions?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Contact our support team for personalized assistance
            </p>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
}
