// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2024 AuditForge Contributors
import { test as setup, expect } from "@playwright/test";

/**
 * Auth setup project — verifies the dev-stack auth is functional before
 * any critical journey runs. Stores storage state for each role.
 */

setup("verify dev stack health", async ({ request }) => {
  if (process.env["E2E_SKIP_GLOBAL_SETUP"] === "1") {
    setup.info().annotations.push({ type: "skip", description: "E2E_SKIP_GLOBAL_SETUP=1" });
    return;
  }
  const apiUrl = process.env["E2E_API_URL"] ?? "http://localhost:3001";
  const res = await request.get(`${apiUrl}/health`);
  expect(res.status(), "Dev stack API must be healthy").toBe(200);
});
