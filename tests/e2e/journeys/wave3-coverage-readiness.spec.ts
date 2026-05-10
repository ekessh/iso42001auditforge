// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Wave-3: a Readiness-Mode engagement displays the mandatory non-certification
 * disclaimer on the coverage dashboard. Audit-Mode engagements must NOT show
 * the disclaimer (negative test for safety).
 *
 * @tags @critical @smoke @wave3
 */
import { test, expect } from "@playwright/test";
import { AuthPo } from "../helpers/po/auth.po";
import { requireApi, requireWebStub } from "../helpers/require-api";

const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:3001";

test.describe("@wave3 @smoke Readiness-Mode disclaimer", () => {
  test("readiness mode shows non-certification disclaimer", async ({ page, request }) => {
    await requireWebStub(request);
    await requireApi(request);

    const fixture = await request.get(`${API_URL}/dev/fixtures/engagement-readiness-mode`);
    test.skip(!fixture.ok(), "no readiness-mode fixture available");
    const { engagementId } = await fixture.json();

    const auth = new AuthPo(page);
    await auth.gotoSignIn();
    await auth.signInWithPasskeyStub();
    await auth.expectOnDashboard();

    await page.goto(`/engagements/${engagementId}/coverage`);
    await expect(page.getByTestId("readiness-disclaimer")).toBeVisible();
    await expect(page.getByTestId("readiness-disclaimer")).toContainText(
      /not a certification|appears ready/i,
    );
  });

  test("audit mode does not show readiness disclaimer", async ({ page, request }) => {
    await requireWebStub(request);
    await requireApi(request);

    const fixture = await request.get(`${API_URL}/dev/fixtures/engagement-audit-mode`);
    test.skip(!fixture.ok(), "no audit-mode fixture available");
    const { engagementId } = await fixture.json();

    const auth = new AuthPo(page);
    await auth.gotoSignIn();
    await auth.signInWithPasskeyStub();
    await auth.expectOnDashboard();

    await page.goto(`/engagements/${engagementId}/coverage`);
    await expect(page.getByTestId("readiness-disclaimer")).toHaveCount(0);
  });
});
