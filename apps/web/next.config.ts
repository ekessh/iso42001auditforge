// SPDX-License-Identifier: BUSL-1.1
import type { NextConfig } from 'next';
import { createRequire } from 'node:module';

export { buildCsp } from './lib/csp';

const requireFromHere = createRequire(import.meta.url);

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

// next-pwa wraps the config when installed. Loaded lazily so unit tests that
// import next.config.ts (e.g. apps/web/next.config.spec.ts) don't require the
// module to be present.
type WithPwaWrapper = (opts: Record<string, unknown>) => (cfg: NextConfig) => NextConfig;

function loadPwa(): WithPwaWrapper | null {
  try {
    const mod: unknown = requireFromHere('next-pwa');
    if (typeof mod === 'function') return mod as WithPwaWrapper;
    if (mod && typeof (mod as { default?: unknown }).default === 'function') {
      return (mod as { default: WithPwaWrapper }).default;
    }
    return null;
  } catch {
    return null;
  }
}

const withPwa = loadPwa();
const finalConfig: NextConfig = withPwa
  ? withPwa({
      dest: 'public',
      register: true,
      skipWaiting: true,
      disable: process.env.NODE_ENV === 'development',
      runtimeCaching: [
        {
          urlPattern: /^https?:\/\/[^/]+\/v1\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'auditforge-api-v1',
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
          },
        },
        {
          urlPattern: /\/_next\/static\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'auditforge-next-static',
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        },
      ],
    })(config)
  : config;

export default finalConfig;
