// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Wave-3 smoke: passkey-stub signin redirects to /dashboard.
 *
 * Driven by NEXT_PUBLIC_AUTH_STUB=1 so we don't depend on a real WebAuthn
 * provider in CI. Skipped if web stub is not active.
 *
 * @tags @critical @smoke @wave3
 */
import { test, expect } from "@playwright/test";
import { AuthPo } from "../helpers/po/auth.po";
import { requireWebStub } from "../helpers/require-api";

test.describe("@wave3 @smoke Auditor login", () => {
  test("signs in via passkey stub and lands on /dashboard", async ({ page, request }) => {
    await requireWebStub(request);

    const auth = new AuthPo(page);
    await auth.gotoSignIn();
    await auth.signInWithPasskeyStub("lead@auditforge.test");
    await auth.expectOnDashboard();

    // Auth store boundary: the page exposes a typed snapshot via window for tests.
    // We assert minimal shape only — PII must not be persisted (ADR-0018).
    const session = await page.evaluate(() => {
      const w = window as unknown as { __sessionSnapshot?: Record<string, unknown> };
      return w.__sessionSnapshot ?? null;
    });
    expect(session).toBeTruthy();
    expect(session).not.toHaveProperty("email");
    expect(session).not.toHaveProperty("name");
  });
});
