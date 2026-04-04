/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@refinedev/antd"],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Allow external access
  experimental: {
    serverComponentsExternalPackages: [],
    // Enable Ant Design tree-shaking
    esmExternals: "loose",
    // Optimize imports for Ant Design
    optimizePackageImports: ["@ant-design/icons", "antd"],
  },

  // Performance optimizations
  swcMinify: true,
  compress: true,

  // API Proxy - Rewrite API requests to backend server
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

    // CSP connect-src: allow Next.js dev server WebSocket in development
    const connectSrc = [
      "'self'",
      "https://api.iotdb-enhanced.com",
      "http://localhost:8000",
      "https://localhost:8000",
      "ws://localhost:8000",
      "wss://localhost:8000"
    ];

    // Add Next.js dev server WebSocket for HMR in development
    if (isDev) {
      connectSrc.push("ws://localhost:5001", "wss://localhost:5001");
    }

    // frame-src: allow development tools in development mode
    const frameSrc = isDev ? "'self' http://localhost:5001" : "'none'";

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
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
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  },

  // Webpack configuration for bundle optimization
  webpack: (config, { isServer }) => {
    // Reduce bundle size by excluding unnecessary packages
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Optimize bundle size
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
          },
          // Vendor chunk for react and related libraries
          react: {
            name: 'react',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          },
          // Vendor chunk for ant design
          antd: {
            name: 'antd',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@ant-design|antd)[\\/]/,
          },
        },
      },
    };

    return config;
  },
};

export default nextConfig;
