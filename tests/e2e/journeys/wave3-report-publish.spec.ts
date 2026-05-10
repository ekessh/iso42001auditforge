// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Wave-3: draft report → QA checklist → publish → download includes signature
 * and TSA timestamp token. The downloaded artefact is parsed for the
 * `/Subtype /Sig` and TSA markers (PDF/A-3 + ADR-0020).
 *
 * @tags @journey @wave3
 */
import { test } from "@playwright/test";
import { AuthPo } from "../helpers/po/auth.po";
import { ReportPo } from "../helpers/po/report.po";
import { requireApi, requireWebStub } from "../helpers/require-api";

const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:3001";

test.describe("@wave3 @journey Report publish", () => {
  test("publish emits a signed PDF/A-3 with TSA token", async ({ page, request }) => {
    await requireWebStub(request);
    await requireApi(request);

    const fixture = await request.get(`${API_URL}/dev/fixtures/engagement-ready-to-publish`);
    test.skip(!fixture.ok(), "no ready-to-publish fixture available");
    const { engagementId } = await fixture.json();

    const auth = new AuthPo(page);
    await auth.gotoSignIn();
    await auth.signInWithPasskeyStub();
    await auth.expectOnDashboard();

    const report = new ReportPo(page);
    await report.openDraft(engagementId);
    await report.runQaChecklist();
    const download = await report.publish();
    await report.expectIncludesSignatureAndTsa(download);
  });
});
