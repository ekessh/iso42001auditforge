// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 AuditForge Contributors
import { type Page, expect } from "@playwright/test";

export class EngagementsPo {
  constructor(private readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto("/engagements");
    await this.page.waitForLoadState("networkidle");
  }

  async createMinimal(name: string, scope = "AI Model Lifecycle"): Promise<string> {
    await this.page.getByRole("button", { name: /new engagement/i }).click();
    await this.page.getByLabel(/engagement name/i).fill(name);
    await this.page.getByLabel(/scope/i).fill(scope);
    await this.page.getByRole("button", { name: /create/i }).click();
    await this.page.waitForURL(/\/engagements\/[a-z0-9-]+/);
    const id = this.page.url().split("/engagements/")[1]?.split("/")[0];
    expect(id).toBeTruthy();
    return id!;
  }

  async openWorkspace(id: string): Promise<void> {
    await this.page.getByRole("link", { name: /workspace/i }).click();
    await this.page.waitForURL(new RegExp(`/engagements/${id}/workspace`));
  }
}
