// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { type Page, expect } from "@playwright/test";

export class FindingsPo {
  constructor(private readonly page: Page) {}

  async gotoCandidates(engagementId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/findings?tab=candidates`);
    await this.page.waitForLoadState("networkidle");
  }

  async openFirstCandidate(): Promise<void> {
    await this.page.locator('[data-testid="candidate-row"]').first().click();
  }

  async promoteToFormal(): Promise<void> {
    await this.page.getByRole("button", { name: /promote to formal/i }).click();
    // Confirmation gate — auditor must explicitly confirm
    await this.page.getByRole("button", { name: /yes,? confirm/i }).click();
  }

  async expectPromoted(): Promise<void> {
    await expect(this.page.getByText(/finding promoted/i)).toBeVisible();
  }
}
