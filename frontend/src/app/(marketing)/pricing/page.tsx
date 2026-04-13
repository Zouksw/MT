"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      name: "免费版",
      description: "适合个人开发者和小团队",
      price: { monthly: 0, yearly: 0 },
      features: [
        "10,000 数据点/天",
        "1 个数据集",
        "基础查询",
        "社区支持",
        "7 天数据保留",
      ],
      cta: "开始使用",
      highlighted: false,
    },
    {
      name: "专业版",
      description: "适合成长中的团队和企业",
      price: { monthly: 49, yearly: 39 },
      features: [
        "1M 数据点/天",
        "无限数据集",
        "AI 预测分析",
        "异常检测",
        "邮件支持",
        "30 天数据保留",
        "API 访问",
        "自定义仪表板",
      ],
      cta: "开始试用",
      highlighted: true,
    },
    {
      name: "企业版",
      description: "适合大规模部署和定制需求",
      price: { monthly: 199, yearly: 159 },
      features: [
        "无限数据点",
        "无限数据集",
        "所有 AI 功能",
        "高级异常检测",
        "优先支持",
        "永久数据保留",
        "私有部署",
        "SLA 保证",
        "定制开发",
      ],
      cta: "联系销售",
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="text-white font-semibold text-lg">I</span>
              </div>
              <span className="text-h4 font-display font-semibold text-gray-900 dark:text-gray-50">
                IoTDB Enhanced
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-body text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                首页
              </Link>
              <Link href="/about" className="text-body text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                关于
              </Link>
              <Link href="/dashboard">
                <Button variant="primary" size="sm">
                  登录
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-display text-gray-900 dark:text-gray-50 mb-6">
            简单透明的定价
          </h1>
          <p className="text-body-lg text-gray-600 dark:text-gray-400 mb-10">
            选择最适合您的方案，随时升级或取消
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-gray-100 dark:bg-gray-900 rounded-full p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-full text-body font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 shadow-sm"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              按月付费
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-full text-body font-medium transition-all relative ${
                billingCycle === "yearly"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 shadow-sm"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              按年付费
              <span className="absolute -top-1 -right-1 bg-success text-white text-xs px-2 py-0.5 rounded-full">
                省 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`relative rounded-lg p-8 border-2 transition-all ${
                  plan.highlighted
                    ? "border-primary bg-white dark:bg-gray-800 shadow-lg scale-105"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-body-sm font-medium px-4 py-1 rounded-full">
                      最受欢迎
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-h3 font-display font-semibold text-gray-900 dark:text-gray-50 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-body text-gray-600 dark:text-gray-400 mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-display font-semibold text-gray-900 dark:text-gray-50 data-text">
                      ${plan.price[billingCycle]}
                    </span>
                    <span className="text-body text-gray-600 dark:text-gray-400">
                      /月
                    </span>
                  </div>
                  {billingCycle === "yearly" && plan.price.yearly > 0 && (
                    <p className="text-body-sm text-gray-500 dark:text-gray-400 mt-2">
                      年付 ${plan.price.yearly * 12}/年
                    </p>
                  )}
                </div>

                <Link href="/dashboard" className="block">
                  <Button
                    variant={plan.highlighted ? "primary" : "secondary"}
                    size="lg"
                    fullWidth
                    className="mb-6"
                  >
                    {plan.cta}
                  </Button>
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature, featureIdx) => (
                    <li key={featureIdx} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-success flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-body text-gray-600 dark:text-gray-400">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-h1 text-gray-900 dark:text-gray-50 mb-4">
              常见问题
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "可以随时取消订阅吗？",
                a: "是的，您可以随时取消订阅，无需任何理由。取消后，您可以在当前计费周期结束前继续使用服务。",
              },
              {
                q: "免费版有使用期限吗？",
                a: "免费版没有使用期限，您可以永久免费使用。如果需要更多功能或数据点，可以随时升级到付费版。",
              },
              {
                q: "如何支付？",
                a: "我们支持信用卡、借记卡和 PayPal。对于企业版，我们还支持银行转账和发票支付。",
              },
              {
                q: "升级后可以降级吗？",
                a: "可以，您可以随时在账户设置中更改订阅计划。降级将在当前计费周期结束后生效。",
              },
              {
                q: "企业版包含哪些定制服务？",
                a: "企业版包括私有部署、定制开发、专属客户经理、SLA 保证和优先技术支持。联系我们了解详情。",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800"
              >
                <h3 className="text-h4 font-display font-semibold text-gray-900 dark:text-gray-50 mb-2">
                  {faq.q}
                </h3>
                <p className="text-body text-gray-600 dark:text-gray-400 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-h1 text-gray-900 dark:text-gray-50 mb-6">
            还有疑问？
          </h2>
          <p className="text-body-lg text-gray-600 dark:text-gray-400 mb-10">
            我们的销售团队随时为您提供帮助
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" className="min-w-[160px]">
              联系销售
            </Button>
            <Button variant="ghost" size="lg" className="min-w-[160px]">
              查看文档
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-body-sm text-gray-500 dark:text-gray-400">
            © 2026 IoTDB Enhanced. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
