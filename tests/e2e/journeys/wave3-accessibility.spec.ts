// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Wave-3: axe-core scan on every primary route — must produce no critical
 * violations. WCAG 2.2 AA per CLAUDE.md.
 *
 * @tags @critical @smoke @wave3 @a11y
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { AuthPo } from "../helpers/po/auth.po";
import { requireWebStub } from "../helpers/require-api";

const PRIMARY_ROUTES = [
  "/auth/signin",
  "/dashboard",
  "/engagements",
  "/findings",
  "/reports",
  "/settings",
];

test.describe("@wave3 @smoke @a11y Accessibility (axe-core, WCAG 2.2 AA)", () => {
  for (const route of PRIMARY_ROUTES) {
    test(`no critical/serious violations on ${route}`, async ({ page, request }) => {
      await requireWebStub(request);

      if (route !== "/auth/signin") {
        const auth = new AuthPo(page);
        await auth.gotoSignIn();
        await auth.signInWithPasskeyStub();
        await auth.expectOnDashboard();
      }

      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();

      const blocking = results.violations.filter((v) =>
        v.impact === "critical" || v.impact === "serious",
      );
      expect(blocking, `axe violations on ${route}:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);
    });
  }
});
