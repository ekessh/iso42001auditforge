// SPDX-License-Identifier: BUSL-1.1
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
