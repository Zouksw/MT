"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-lg">I</span>
              </div>
              <span className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50">
                IoTDB Enhanced
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-body text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                功能
              </a>
              <a href="#demo" className="text-body text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                演示
              </a>
              <a href="/pricing" className="text-body text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                定价
              </a>
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
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-light dark:bg-primary/10 text-primary-dark dark:text-primary-light text-body-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            基于 Apache IoTDB 2.0.5 + AI Node
          </div>

          <h1 className="text-display text-gray-900 dark:text-gray-50 mb-6 max-w-4xl mx-auto">
            新一代时序数据库平台
            <span className="text-primary">智能预测</span> ·
            <span className="text-primary">异常检测</span> ·
            <span className="text-primary">实时监控</span>
          </h1>

          <p className="text-body-lg text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            为工业物联网打造的增强型时序数据分析平台。
            集成 AI 预测引擎，支持实时异常检测，提供强大的数据可视化和分析能力。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/dashboard">
              <Button variant="primary" size="lg" className="min-w-[160px]">
                开始使用
              </Button>
            </Link>
            <Button variant="ghost" size="lg" className="min-w-[160px]">
              查看文档
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
            <div>
              <div className="text-4xl font-display font-bold text-primary mb-1">
                10M+
              </div>
              <div className="text-body-sm text-gray-500 dark:text-gray-400">
                数据点/秒
              </div>
            </div>
            <div>
              <div className="text-4xl font-display font-bold text-primary mb-1">
                &lt;100ms
              </div>
              <div className="text-body-sm text-gray-500 dark:text-gray-400">
                查询延迟
              </div>
            </div>
            <div>
              <div className="text-4xl font-display font-bold text-primary mb-1">
                99.9%
              </div>
              <div className="text-body-sm text-gray-500 dark:text-gray-400">
                可用性
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-h1 text-gray-900 dark:text-gray-50 mb-4">
              强大的功能
            </h2>
            <p className="text-body-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              为工业级场景设计的完整功能集
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary-light dark:bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50 mb-2">
                高性能存储
              </h3>
              <p className="text-body text-gray-600 dark:text-gray-400 leading-relaxed">
                基于 Apache IoTDB 2.0.5，支持每秒千万级数据点写入，优化的压缩算法节省 90% 存储空间。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-success-light dark:bg-success/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50 mb-2">
                AI 预测引擎
              </h3>
              <p className="text-body text-gray-600 dark:text-gray-400 leading-relaxed">
                集成 7 种机器学习算法（ARIMA、LSTM、Transformer），自动预测未来数据趋势。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-error-light dark:bg-error/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50 mb-2">
                异常检测
              </h3>
              <p className="text-body text-gray-600 dark:text-gray-400 leading-relaxed">
                实时监控数据流，自动识别异常模式，支持多种检测算法和自定义告警规则。
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-info-light dark:bg-info/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50 mb-2">
                数据可视化
              </h3>
              <p className="text-body text-gray-600 dark:text-gray-400 leading-relaxed">
                丰富的图表类型，支持实时数据流展示，自定义仪表板，灵活的布局配置。
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-secondary-light dark:bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50 mb-2">
                安全可靠
              </h3>
              <p className="text-body text-gray-600 dark:text-gray-400 leading-relaxed">
                企业级安全，支持 RBAC 权限控制、审计日志、数据加密，符合 ISO 27001 标准。
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-all duration-200 hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-h4 font-display font-bold text-gray-900 dark:text-gray-50 mb-2">
                开放 API
              </h3>
              <p className="text-body text-gray-600 dark:text-gray-400 leading-relaxed">
                RESTful API，支持 SDK 集成，易于与现有系统集成，提供完整的开发者文档。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-h1 text-gray-900 dark:text-gray-50 mb-4">
              直观的数据展示
            </h2>
            <p className="text-body-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              专为时序数据设计的交互式界面
            </p>
          </div>

          {/* Dashboard Preview */}
          <div className="bg-gray-900 dark:bg-gray-950 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
            {/* Mock Dashboard Header */}
            <div className="bg-gray-800 dark:bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span className="text-body-sm text-gray-400">Online</span>
                </div>
              </div>
            </div>

            {/* Mock Dashboard Content */}
            <div className="p-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "总设备数", value: "1,234", change: "+12%", color: "primary" },
                  { label: "活跃设备", value: "1,180", change: "+8%", color: "success" },
                  { label: "异常告警", value: "23", change: "-15%", color: "error" },
                  { label: "数据点/秒", value: "8.5K", change: "+22%", color: "info" },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-gray-800 dark:bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="text-body-sm text-gray-400 mb-2">{stat.label}</div>
                    <div className="text-2xl font-display font-bold text-white mb-1 data-text">
                      {stat.value}
                    </div>
                    <div className={`text-body-sm ${stat.change.startsWith("+") ? "text-success" : "text-error"}`}>
                      {stat.change}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mock Chart Area */}
              <div className="bg-gray-800 dark:bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-h4 font-display font-bold text-white">实时数据流</div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded text-body-sm bg-primary text-white">温度</span>
                    <span className="px-3 py-1 rounded text-body-sm bg-gray-700 text-gray-300">湿度</span>
                  </div>
                </div>
                {/* Mock Line Chart */}
                <div className="h-48 flex items-end gap-1">
                  {Array.from({ length: 50 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-primary/20 to-primary/80 rounded-t"
                      style={{
                        height: `${30 + Math.random() * 60}%`,
                      }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-h1 text-gray-900 dark:text-gray-50 mb-6">
            准备开始了吗？
          </h2>
          <p className="text-body-lg text-gray-600 dark:text-gray-400 mb-10">
            立即注册，获得 14 天免费试用，无需信用卡
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button variant="primary" size="lg" className="min-w-[160px]">
                免费开始
              </Button>
            </Link>
            <Button variant="ghost" size="lg" className="min-w-[160px]">
                联系销售
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-body font-semibold text-gray-900 dark:text-gray-50 mb-4">
                产品
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    功能
                  </a>
                </li>
                <li>
                  <a href="/pricing" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    定价
                  </a>
                </li>
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    文档
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-body font-semibold text-gray-900 dark:text-gray-50 mb-4">
                公司
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="/about" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    关于我们
                  </a>
                </li>
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    博客
                  </a>
                </li>
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    招聘
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-body font-semibold text-gray-900 dark:text-gray-50 mb-4">
                资源
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    API 文档
                  </a>
                </li>
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    社区
                  </a>
                </li>
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    支持
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-body font-semibold text-gray-900 dark:text-gray-50 mb-4">
                法律
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    隐私政策
                  </a>
                </li>
                <li>
                  <a href="#" className="text-body-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                    服务条款
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
            <p className="text-body-sm text-gray-500 dark:text-gray-400">
              © 2026 IoTDB Enhanced. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
