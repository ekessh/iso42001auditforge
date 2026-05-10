// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.test if present (dev stack values)
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./journeys",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 2 : 4,

  // Per-test timeout: 60 s; per-journey timeout: 5 min
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ...(process.env["CI"]
      ? [["github"] as ["github"]]
      : []),
  ],

  globalSetup: "./helpers/global-setup.ts",
  globalTeardown: "./helpers/global-teardown.ts",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "on",

    // Extra HTTP headers for all requests
    extraHTTPHeaders: {
      "x-test-run": process.env["CI"] ? "ci" : "local",
    },

    // LCP budget via Navigation Timing — enforced in individual tests
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },

  projects: [
    // ── Setup project (auth seeds & fixtures) ────────────────────────────
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // ── Critical journey projects (PR gate, <10 min total) ───────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      grep: /@critical|@journey|@wave3|@smoke/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
      grep: /@critical/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
      grep: /@critical/,
    },
    {
      name: "iphone",
      use: {
        ...devices["iPhone 14"],
        // Mobile auditor: onsite capture journeys
      },
      dependencies: ["setup"],
      grep: /@mobile/,
    },

    // ── Nightly-only full suite ───────────────────────────────────────────
    {
      name: "chromium-full",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      grep: /@nightly|@regression/,
    },
    {
      name: "firefox-full",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
      grep: /@nightly/,
    },
    {
      name: "webkit-full",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
      grep: /@nightly/,
    },
  ],

  // Output directory for artifacts (traces, videos, screenshots)
  outputDir: "test-results/artifacts",

  webServer: process.env["CI"]
    ? undefined
    : {
        command: "pnpm --filter @auditforge/web dev",
        url: BASE_URL,
        reuseExistingServer: !process.env["CI"],
        timeout: 120_000,
        env: {
          DATABASE_URL: process.env["DATABASE_URL"] ?? "postgresql://auditforge:auditforge@localhost:5432/auditforge_test",
          REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:6379",
          MINIO_ENDPOINT: process.env["MINIO_ENDPOINT"] ?? "http://localhost:9000",
        },
      },
});
