// SPDX-License-Identifier: BUSL-1.1
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['suites/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
