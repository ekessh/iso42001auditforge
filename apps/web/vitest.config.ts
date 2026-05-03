// SPDX-License-Identifier: BUSL-1.1
import * as path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Vitest config for `apps/web`.
 *
 * Required so tests can resolve the same `@/*` alias that
 * `apps/web/tsconfig.json` defines under `paths`. Without this alias the
 * stories smoke test (and any future Vitest-based component tests) cannot
 * follow `@/lib/mocks/...` style imports that the production code relies on.
 *
 * No new runtime dependencies — `vitest` is already a workspace dev dep.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  // Disable PostCSS / CSS pipeline — story modules transitively import nothing
  // CSS-bound, and the apps/web PostCSS config requires Tailwind v4 plugins
  // that are only resolvable via the Next.js dev runtime.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
  },
});
