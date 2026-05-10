// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { test, type APIRequestContext } from "@playwright/test";

/**
 * Skip a wave-3 e2e test if the dev API isn't reachable. We intentionally
 * write these tests as smoke-checks that prefer "skip with reason" over
 * hard-failing in environments without a full backend.
 */
export async function requireApi(request: APIRequestContext, apiUrl?: string): Promise<void> {
  const url = apiUrl ?? process.env["E2E_API_URL"] ?? "http://localhost:3001";
  try {
    const res = await request.get(`${url}/health`, { timeout: 3_000 });
    if (!res.ok()) test.skip(true, `API not healthy: ${res.status()}`);
  } catch (err) {
    test.skip(true, `API unreachable at ${url}: ${(err as Error).message}`);
  }
}

export async function requireWebStub(request: APIRequestContext, baseUrl?: string): Promise<void> {
  const url = baseUrl ?? process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await request.get(`${url}/api/health/stub`, { timeout: 3_000 });
    if (!res.ok()) test.skip(true, `Web stub not active: ${res.status()}`);
  } catch (err) {
    test.skip(true, `Web stub unreachable at ${url}: ${(err as Error).message}`);
  }
}
