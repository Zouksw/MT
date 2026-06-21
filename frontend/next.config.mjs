import path from 'path';
import { fileURLToPath } from 'url';
import withBundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@refinedev/antd"],
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  experimental: {
    // Optimize barrel imports — dramatically reduces module count
    optimizePackageImports: [
      "@ant-design/icons",
      "antd",
      "@phosphor-icons/react",
      "framer-motion",
      "recharts",
      "lodash",
      "@refinedev/antd",
      "@refinedev/core",
      "dayjs",
    ],
  },

  // Performance
  compress: true,

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // API Proxy
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

  // Security Headers
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';

    const connectSrc = [
      "'self'",
      "http://localhost:8000",
      "https://localhost:8000",
      "ws://localhost:8000",
      "wss://localhost:8000"
    ];

    if (isDev) {
      connectSrc.push("ws://localhost:5001", "wss://localhost:5001");
    }

    const frameSrc = isDev ? "'self' http://localhost:5001" : "'none'";

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src ${connectSrc.join(' ')}`,
              `frame-src ${frameSrc}`,
              "object-src 'self' data:",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ];
  },

  // Webpack — production-only optimizations
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Only apply splitChunks in production builds — it slows dev compilation
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
              // Keep heavy charting libs OUT of commons — without this they get
              // hoisted into the shared bundle and every page (login, settings...)
              // pays the cost on first load. recharts/d3 are only needed on chart pages.
              test: (module) => {
                const path = module.resourceForRule || module.context || '';
                return !/[\\/]node_modules[\\/](recharts|d3|victory|visx|chart\.js|lightweight-charts)[\\/]/.test(path);
              },
            },
            react: {
              name: 'react',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            // Charts into their own lazy chunk so non-chart pages stay light.
            recharts: {
              name: 'recharts',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](recharts|d3[-a-z]*|victory|internmap|delaunator|robust-predicates)[\\/]/,
            },
            antd: {
              name: 'antd',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](@ant-design|antd)[\\/]/,
            },
          },
        },
      };
    }

    return config;
  },
};

export default withNextIntl(
  withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  })(nextConfig)
);
