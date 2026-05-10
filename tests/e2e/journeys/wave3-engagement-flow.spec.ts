// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Wave-3 smoke: create engagement, list, open detail, navigate to workspace.
 * Skipped without a backend — see helpers/require-api.ts.
 *
 * @tags @critical @smoke @wave3
 */
import { test, expect } from "@playwright/test";
import { AuthPo } from "../helpers/po/auth.po";
import { EngagementsPo } from "../helpers/po/engagements.po";
import { requireApi, requireWebStub } from "../helpers/require-api";

test.describe("@wave3 @smoke Engagement flow", () => {
  test("creates engagement, sees it in list, opens workspace", async ({ page, request }) => {
    await requireWebStub(request);
    await requireApi(request);

    const auth = new AuthPo(page);
    await auth.gotoSignIn();
    await auth.signInWithPasskeyStub();
    await auth.expectOnDashboard();

    const engagements = new EngagementsPo(page);
    await engagements.gotoList();

    const ts = Date.now();
    const id = await engagements.createMinimal(`Wave3 Smoke ${ts}`);

    await engagements.gotoList();
    await expect(page.getByText(`Wave3 Smoke ${ts}`)).toBeVisible();

    await page.getByText(`Wave3 Smoke ${ts}`).click();
    await page.waitForURL(new RegExp(`/engagements/${id}`));
    await engagements.openWorkspace(id);
  });
});
