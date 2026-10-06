import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUILD_ID = process.env.WORKGRIND_BUILD_ID || randomUUID();
const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  distDir: isProduction ? '.next' : '.next-dev',
  generateBuildId: async () => BUILD_ID,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  experimental: {
    // Persistent dev graph reuse can leave stale module factories after source/HMR updates.
    // Keep production build caching enabled; disable only the cross-restart dev cache.
    turbopackFileSystemCacheForDev: false,
  },

  // Use Turbopack by default in Next 16 and keep the app root explicit to avoid
  // workspace lockfile warnings when the repo root and frontend folder are both checked.
  turbopack: {
    root: __dirname,
    resolveAlias: {
      sharp: { browser: './empty.ts' },
      'onnxruntime-node': { browser: './empty.ts' },
    },
  },

  // Disable source maps in development to save RAM
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },

  // ── API proxy rewrites ─────────────────────────────────────────────────────
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    return [
      {
        source: '/socket.io',
        destination: `${backendUrl}/socket.io/`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // ── Headers ────────────────────────────────────────────────────────────────
  async headers() {
    return [
      ...(!isProduction ? [{
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        ],
      }] : []),
      ...(isProduction ? [
        {
          source: '/:path*',
          has: [{ type: 'header', key: 'accept', value: '.*text/html.*' }],
          headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }],
        },
        {
          source: '/:path*',
          has: [{ type: 'header', key: 'rsc', value: '1' }],
          headers: [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }],
        },
      ] : []),
      // Leave Next's own static-asset cache policy intact: dev modules are revalidated,
      // while hashed production chunks are immutable.
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type',           value: 'application/javascript; charset=UTF-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control',          value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type',  value: 'application/manifest+json; charset=UTF-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/:icon(icon-:size.png|apple-touch-icon.png|icon-maskable-:size.png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
