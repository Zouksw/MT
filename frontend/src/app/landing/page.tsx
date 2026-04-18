"use client";

import React, { useState } from "react";
import { Button, Typography, Col, Row, Divider } from "antd";
import { ArrowUpOutlined, GithubOutlined, TwitterOutlined, MenuOutlined, CloseOutlined } from "@ant-design/icons";
import dynamic from "next/dynamic";

// Lazy load sections for better performance
const Hero = dynamic(() => import("@/components/landing/Hero"), {
  loading: () => <div style={{ height: "400px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>Loading...</div>,
  ssr: true,
});
const Features = dynamic(() => import("@/components/landing/Features"), {
  loading: () => <div style={{ height: "200px" }} />,
  ssr: false,
});
const GettingStarted = dynamic(() => import("@/components/landing/GettingStarted"), {
  loading: () => <div style={{ height: "200px" }} />,
  ssr: false,
});
const FAQ = dynamic(() => import("@/components/landing/FAQ"), {
  loading: () => <div style={{ height: "200px" }} />,
  ssr: false,
});
const SocialProof = dynamic(() => import("@/components/landing/SocialProof"), {
  loading: () => <div style={{ height: "60px" }} />,
  ssr: false,
});

const { Title, Text, Paragraph } = Typography;

/**
 * Landing Page - Commercial SaaS Marketing Homepage
 *
 * A modern, professional landing page showcasing TradeMind AI
 * with hero section, features, pricing, FAQ, and getting started guide.
 */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={{ overflowX: "hidden" }}>
      {/* Navigation */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "#ffffff",
          boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px",
          padding: "16px 24px",
        }}
      >
        <style>{`
          @media (max-width: 768px) {
            .landing-nav-links { display: none !important; }
            .landing-nav-toggle { display: flex !important; }
            .landing-nav-links.open {
              display: flex !important;
              position: absolute;
              top: 100%;
              left: 0;
              right: 0;
              background: #ffffff;
              flex-direction: column;
              padding: 16px 24px;
              gap: 12px;
              border-bottom: 1px solid rgba(0, 0, 0, 0.05);
            }
            .landing-nav-links.open a {
              padding: 12px 0;
              font-size: 16px;
              display: block;
            }
          }
          @media (min-width: 769px) {
            .landing-nav-toggle { display: none !important; }
          }
        `}</style>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#171717",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "12px",
                fontWeight: 600,
                color: "#fff",
                fontSize: "18px",
              }}
            >
              I
            </div>
            <Text strong style={{ fontSize: "18px" }}>
              TradeMind AI
            </Text>
          </div>

          <nav
            className={`landing-nav-links${mobileMenuOpen ? " open" : ""}`}
            style={{ display: "flex", gap: "32px", alignItems: "center" }}
          >
            <a
              href="#features"
              style={{ color: "#64748b", textDecoration: "none", fontWeight: 500, fontSize: "15px" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#faq"
              style={{ color: "#64748b", textDecoration: "none", fontWeight: 500, fontSize: "15px" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </a>
            <Button
              type="primary"
              style={{
                background: "#171717",
                border: "none",
                borderRadius: "6px",
                height: "40px",
                padding: "0 20px",
              }}
              href="/register"
            >
              Get Started
            </Button>
          </nav>

          <Button
            type="text"
            className="landing-nav-toggle"
            icon={mobileMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: "none",
              minWidth: "44px",
              minHeight: "44px",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </div>
      </header>

      {/* Hero Section */}
      <Hero />

      {/* Social Proof Marquee */}
      <SocialProof />

      {/* Features Section */}
      <Features />

      {/* Pricing Section - Temporarily hidden */}
      {/* <Pricing /> */}

      {/* Getting Started Section */}
      <GettingStarted />

      {/* FAQ Section */}
      <FAQ />

      {/* CTA Section */}
      <section
        className="relative overflow-hidden"
        style={{
          padding: "clamp(60px, 8vw, 100px) 24px",
          background: "#171717",
          textAlign: "center",
        }}
      >
        {/* Decorative blurred circles */}
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-10 right-20 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-white/3 blur-2xl" />

        <div className="relative z-10" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <Title
            level={2}
            style={{
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 600,
              color: "#fff",
              marginBottom: "20px",
            }}
          >
            Ready to Get Started?
          </Title>
          <Paragraph
            style={{
              fontSize: "18px",
              color: "rgba(255, 255, 255, 0.9)",
              marginBottom: "32px",
            }}
          >
            Join thousands of teams already using TradeMind AI to power their time
            series data platform.
          </Paragraph>
          <Button
            size="large"
            style={{
              height: "52px",
              padding: "0 40px",
              fontSize: "16px",
              fontWeight: 600,
              borderRadius: "8px",
              background: "#fff",
              color: "#0a72ef",
              border: "none",
              boxShadow: "rgba(0, 0, 0, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 2px 2px",
            }}
            href="/register"
          >
            Start Free Trial
          </Button>
          <p className="mt-4 text-sm text-white/60">
            No credit card required. Free 14-day trial.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "clamp(32px, 5vw, 60px) 24px",
          background: "#171717",
          color: "#fff",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <Row gutter={[48, 48]}>
            <Col xs={24} md={8}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "6px",
                    background: "#171717",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "12px",
                    fontWeight: 600,
                    fontSize: "18px",
                  }}
                >
                  I
                </div>
                <Text strong style={{ fontSize: "18px", color: "#fff" }}>
                  TradeMind AI
                </Text>
              </div>
              <Paragraph style={{ color: "#94a3b8", marginBottom: "16px" }}>
                Enterprise-grade time series database platform with real-time analytics
                and AI-powered insights.
              </Paragraph>
              <div style={{ display: "flex", gap: "16px" }}>
                <GithubOutlined style={{ fontSize: "20px", color: "#94a3b8", cursor: "pointer" }} />
                <TwitterOutlined style={{ fontSize: "20px", color: "#94a3b8", cursor: "pointer" }} />
              </div>
            </Col>

            <Col xs={24} sm={8} md={4}>
              <Title level={5} style={{ fontSize: "16px", color: "#fff", marginBottom: "16px" }}>
                Product
              </Title>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                <li style={{ marginBottom: "8px" }}>
                  <a href="#features" style={{ color: "#94a3b8", textDecoration: "none" }}>
                    Features
                  </a>
                </li>
                {/* Hidden temporarily
                <li style={{ marginBottom: "8px" }}>
                  <a href="#pricing" style={{ color: "#94a3b8", textDecoration: "none" }}>
                    Pricing
                  </a>
                </li>
                */}
                <li style={{ marginBottom: "8px" }}>
                  <a href="#faq" style={{ color: "#94a3b8", textDecoration: "none" }}>
                    FAQ
                  </a>
                </li>
              </ul>
            </Col>


          </Row>

          <Divider style={{ borderColor: "#1e293b", margin: "40px 0 24px" }} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <Text style={{ color: "#64748b", fontSize: "14px" }}>
              © 2025 TradeMind AI. All rights reserved.
            </Text>
            <Button
              type="text"
              icon={<ArrowUpOutlined />}
              onClick={scrollToTop}
              style={{
                color: "#94a3b8",
                minWidth: "44px",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Back to Top
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
