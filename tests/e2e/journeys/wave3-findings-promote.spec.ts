// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
/**
 * Wave-3: promote candidate finding → formal finding requires explicit auditor
 * confirmation. Asserts ledger event recorded via /healthz?ledger=true probe.
 *
 * @tags @journey @wave3
 */
import { test, expect } from "@playwright/test";
import { AuthPo } from "../helpers/po/auth.po";
import { FindingsPo } from "../helpers/po/findings.po";
import { requireApi, requireWebStub } from "../helpers/require-api";

const API_URL = process.env["E2E_API_URL"] ?? "http://localhost:3001";

test.describe("@wave3 @journey Findings promote", () => {
  test("promotion requires confirmation and emits a ledger event", async ({ page, request }) => {
    await requireWebStub(request);
    await requireApi(request);

    // Read engagement id from a seeded fixture endpoint exposed only in dev.
    const fixture = await request.get(`${API_URL}/dev/fixtures/engagement-with-candidate-finding`);
    test.skip(!fixture.ok(), "no candidate-finding fixture available");
    const { engagementId } = await fixture.json();

    const auth = new AuthPo(page);
    await auth.gotoSignIn();
    await auth.signInWithPasskeyStub();
    await auth.expectOnDashboard();

    const findings = new FindingsPo(page);
    await findings.gotoCandidates(engagementId);

    const before = await request.get(`${API_URL}/healthz?ledger=true`);
    const beforeBody = (await before.json()) as { ledgerLength: number };

    await findings.openFirstCandidate();
    await findings.promoteToFormal();
    await findings.expectPromoted();

    const after = await request.get(`${API_URL}/healthz?ledger=true`);
    const afterBody = (await after.json()) as { ledgerLength: number };
    expect(afterBody.ledgerLength).toBeGreaterThan(beforeBody.ledgerLength);
  });
});
