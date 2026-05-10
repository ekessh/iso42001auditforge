// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Wave-3: two browser contexts collaboratively edit the same WP via Yjs.
 * Both peers see each other's text. Skipped without backend Yjs gateway.
 *
 * @tags @journey @wave3
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { AuthPo } from "../helpers/po/auth.po";
import { EngagementsPo } from "../helpers/po/engagements.po";
import { WorkingPaperPo } from "../helpers/po/working-paper.po";
import { requireApi, requireWebStub } from "../helpers/require-api";

async function signedInPage(context: BrowserContext, who: string) {
  const page = await context.newPage();
  const auth = new AuthPo(page);
  await auth.gotoSignIn();
  await auth.signInWithPasskeyStub(who);
  await auth.expectOnDashboard();
  return page;
}

test.describe("@wave3 @journey Working paper collaborative edit", () => {
  test("two peers see each other's edits via Yjs", async ({ browser, request }) => {
    await requireWebStub(request);
    await requireApi(request);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    const pageA = await signedInPage(ctxA, "lead@auditforge.test");
    const pageB = await signedInPage(ctxB, "peer@auditforge.test");

    // Peer A creates an engagement and a WP.
    const engagementsA = new EngagementsPo(pageA);
    await engagementsA.gotoList();
    const id = await engagementsA.createMinimal(`Wave3 Collab ${Date.now()}`);
    await engagementsA.openWorkspace(id);

    // Naive WP id discovery: take the first WP card the workspace renders.
    const firstWp = await pageA.locator('[data-testid="wp-card"]').first().getAttribute("data-id");
    test.skip(!firstWp, "workspace has no working paper to collaborate on");

    const wpA = new WorkingPaperPo(pageA);
    const wpB = new WorkingPaperPo(pageB);
    await wpA.open(id, firstWp!);
    await wpB.open(id, firstWp!);

    await wpA.typeIntoEditor("hello-from-A ");
    await wpB.typeIntoEditor("hello-from-B ");

    await expect.poll(async () => {
      return (await pageA.locator('[data-testid="wp-editor"]').textContent()) ?? "";
    }, { timeout: 10_000 }).toContain("hello-from-B");
    await expect.poll(async () => {
      return (await pageB.locator('[data-testid="wp-editor"]').textContent()) ?? "";
    }, { timeout: 10_000 }).toContain("hello-from-A");

    await ctxA.close();
    await ctxB.close();
  });
});
