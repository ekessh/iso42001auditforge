// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { type Page, expect } from "@playwright/test";

export class WorkingPaperPo {
  constructor(private readonly page: Page) {}

  async open(engagementId: string, workingPaperId: string): Promise<void> {
    await this.page.goto(`/engagements/${engagementId}/working-papers/${workingPaperId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async typeIntoEditor(text: string): Promise<void> {
    const editor = this.page.locator('[data-testid="wp-editor"]');
    await editor.click();
    await editor.type(text, { delay: 5 });
  }

  async expectContains(text: string): Promise<void> {
    await expect(this.page.locator('[data-testid="wp-editor"]')).toContainText(text);
  }
}
