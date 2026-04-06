"use client";

import React, { useState } from "react";
import {
  CloudServerOutlined,
  ThunderboltOutlined,
  SecurityScanOutlined,
  ApiOutlined,
  TeamOutlined,
  DownOutlined,
} from "@ant-design/icons";

interface FAQItem {
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    question: "What is IoTDB Enhanced?",
    answer:
      "IoTDB Enhanced is an enterprise-grade time series database platform built on Apache IoTDB. It provides real-time analytics, AI-powered forecasting, anomaly detection, and a modern web interface for managing your IoT data at scale.",
    icon: <CloudServerOutlined />,
  },
  {
    question: "How does AI-powered forecasting work?",
    answer:
      "Our platform uses multiple machine learning algorithms including ARIMA, Prophet, LSTM, and Transformer models. You can train models on your historical time series data and generate accurate predictions with confidence intervals.",
    icon: <ThunderboltOutlined />,
  },
  {
    question: "Is my data secure?",
    answer:
      "Absolutely. We implement enterprise-grade security including encryption at rest and in transit, role-based access control (RBAC), API key management, and secure session management.",
    icon: <SecurityScanOutlined />,
  },
  {
    question: "Can I integrate with my existing systems?",
    answer:
      "Yes. IoTDB Enhanced provides a RESTful API, WebSocket support for real-time updates, and native IoTDB protocol compatibility. You can also use our SDKs and integrate with popular data pipelines.",
    icon: <ApiOutlined />,
  },
  {
    question: "What deployment options are available?",
    answer:
      "You can deploy on any cloud platform (AWS, GCP, Azure) using managed services like AWS RDS, ElastiCache, or Cloud SQL. We provide comprehensive deployment guides for Docker, Kubernetes, and traditional VM setups.",
    icon: <CloudServerOutlined />,
  },
  {
    question: "Do you offer enterprise support?",
    answer:
      "Yes. Our Enterprise plan includes dedicated support, SLA guarantees, custom integrations, and priority access to new features. Contact our sales team for more information.",
    icon: <TeamOutlined />,
  },
];

export default function FAQ() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <section id="faq" className="bg-white dark:bg-gray-900 px-6 py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <div className="mb-4 inline-block rounded border border-primary/20 bg-primary/8 px-4 py-1.5">
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">FAQ</span>
          </div>
          <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
            Everything you need to know about IoTDB Enhanced
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <div
                key={index}
                className={`rounded-lg border transition-all duration-300 ${
                  isExpanded
                    ? "border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/5"
                    : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700"
                }`}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left md:px-6 md:py-5"
                  aria-expanded={isExpanded}
                >
                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                      isExpanded
                        ? "bg-primary/20 text-primary"
                        : "bg-gray-50 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                    }`}
                  >
                    <span className="text-lg">{faq.icon}</span>
                  </div>

                  {/* Question */}
                  <span
                    className={`flex-1 text-base font-semibold transition-colors duration-300 md:text-lg ${
                      isExpanded ? "text-primary" : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {faq.question}
                  </span>

                  {/* Chevron */}
                  <DownOutlined
                    className={`shrink-0 text-gray-400 transition-transform duration-300 ${
                      isExpanded ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                {/* Answer — with slide-down animation */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 pl-[4.5rem] md:px-6 md:pl-[4.75rem]">
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 md:text-base">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-8 text-center md:mt-16">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Still have questions?
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Contact our support team for personalized assistance
          </p>
        </div>
      </div>
    </section>
  );
}
